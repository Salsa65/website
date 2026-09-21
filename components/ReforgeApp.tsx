'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Bot, ChevronDown, CircleUserRound, Cloud, CloudOff, GripVertical, LogIn, Plus, Save, Sparkles, Users, Volume2, VolumeX, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { addGuestGoal, loadGuestState, newGuestProject, saveGuestState, upsertGuestNote } from '@/lib/guestStore';
import { canEdit, inferSection, slugify } from '@/lib/story';
import type { AuthMode, GuestState, MyriaGoal, MyriaMessage, Note, Profile, Project, Role, Section } from '@/lib/types';
import type { User } from '@supabase/supabase-js';

const uid=()=>crypto.randomUUID();
type AuthTab='signin'|'signup'|'admin';
type MyriaStatus='idle'|'observing'|'thinking'|'talking'|'error';

function Petals(){return <div className="petals" aria-hidden>{Array.from({length:14},(_,i)=><i key={i} style={{left:`${(i*17+7)%100}%`,animationDelay:`-${(i*2.7)%18}s`,animationDuration:`${12+(i%7)*2}s`}} />)}</div>}

function AuthGate({onGuest}:{onGuest:()=>void}){
  const [tab,setTab]=useState<AuthTab>('signin');
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [displayName,setDisplayName]=useState('');
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [message,setMessage]=useState('');
  async function submit(e:FormEvent){e.preventDefault();setError('');setMessage('');if(!supabase){setError('Cloud authentication is not configured on this deployment.');return;}setBusy(true);
    try{
      if(tab==='signup'){
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:displayName||'Creator'}}}); if(error)throw error;
        if(!data.session)setMessage('Account created. Check your email if confirmation is enabled, then sign in.');
      } else {
        const {data,error}=await supabase.auth.signInWithPassword({email,password}); if(error)throw error;
        if(tab==='admin'){
          const {data:profile,error:pErr}=await supabase.from('profiles').select('role').eq('user_id',data.user.id).single();
          if(pErr||profile?.role!=='admin'){await supabase.auth.signOut();throw new Error('This account is not authorized for administrator access.');}
        }
      }
    }catch(err){setError(err instanceof Error?err.message:'Authentication failed.')}finally{setBusy(false)}
  }
  return <main className="gate"><Petals/><section className="gate-card">
    <div className="gate-mark">R</div><p className="eyebrow">THE STORY FORGE</p><h1>REFORGE</h1><p className="gate-copy">Build worlds, shape characters, and keep every fragment of your story in one cinematic workspace.</p>
    <div className="auth-tabs"><button onClick={()=>setTab('signin')} className={tab==='signin'?'active':''}>Sign In</button><button onClick={()=>setTab('signup')} className={tab==='signup'?'active':''}>Create Account</button><button onClick={()=>setTab('admin')} className={tab==='admin'?'active':''}>Administrator</button></div>
    <form className="auth-form" onSubmit={submit}>
      {tab==='signup'&&<label>Display name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} autoComplete="name" /></label>}
      <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" /></label>
      <label>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={tab==='signup'?'new-password':'current-password'} /></label>
      {error&&<p className="form-error">{error}</p>}{message&&<p className="form-ok">{message}</p>}
      <button className="primary wide" disabled={busy}>{busy?'Working…':tab==='signup'?'Create Account':tab==='admin'?'Administrator Login':'Sign In'}</button>
    </form>
    <div className="or"><span/>or<span/></div><button className="ghost wide" onClick={onGuest}>Continue as Guest</button>
    <p className="gate-foot">Guest work stays on this device. Accounts add cloud sync, collaboration, profiles, and persistent Myria project memory.</p>
  </section></main>
}

export default function ReforgeApp(){
  const [booted,setBooted]=useState(false); const [mode,setMode]=useState<AuthMode|null>(null); const [user,setUser]=useState<User|null>(null);
  const [guest,setGuest]=useState<GuestState|null>(null); const [projects,setProjects]=useState<Project[]>([]); const [sections,setSections]=useState<Section[]>([]); const [notes,setNotes]=useState<Note[]>([]); const [profile,setProfile]=useState<Profile|null>(null); const [activeProjectId,setActiveProjectId]=useState(''); const [activeSectionId,setActiveSectionId]=useState('');
  const [cloudBusy,setCloudBusy]=useState(false); const [toast,setToast]=useState(''); const [modal,setModal]=useState<'note'|'section'|'profile'|'collab'|null>(null);
  const [newTitle,setNewTitle]=useState(''); const [newBody,setNewBody]=useState(''); const [sectionTitle,setSectionTitle]=useState(''); const [inviteEmail,setInviteEmail]=useState(''); const [inviteRole,setInviteRole]=useState<'editor'|'viewer'>('editor');
  const [messages,setMessages]=useState<MyriaMessage[]>([{id:'welcome',role:'assistant',content:"I'm Myria. I keep the project coherent while you make it interesting. Ask me to brainstorm, inspect a character, find gaps, or plan the next writing move.",createdAt:Date.now()}]);
  const [chat,setChat]=useState(''); const [myriaStatus,setMyriaStatus]=useState<MyriaStatus>('idle'); const [muted,setMuted]=useState(false); const [goals,setGoals]=useState<MyriaGoal[]>([]);
  const [profileName,setProfileName]=useState(''); const [profileBio,setProfileBio]=useState(''); const [profileAvatar,setProfileAvatar]=useState('');
  const saveTimers=useRef<Record<string,ReturnType<typeof setTimeout>>>({}); const audioRef=useRef<HTMLAudioElement|null>(null); const voiceAbort=useRef<AbortController|null>(null); const speechQueue=useRef<string[]>([]); const speakingRef=useRef(false);

  const activeProject=projects.find(p=>p.id===activeProjectId); const projectSections=useMemo(()=>sections.filter(s=>s.project_id===activeProjectId).sort((a,b)=>a.position-b.position),[sections,activeProjectId]);
  const activeSection=projectSections.find(s=>s.id===activeSectionId)??projectSections[0]; const sectionNotes=useMemo(()=>notes.filter(n=>n.project_id===activeProjectId&&n.section_id===activeSection?.id).sort((a,b)=>a.position-b.position),[notes,activeProjectId,activeSection?.id]);
  const role=(activeProject?.role??'viewer') as Role; const editable=mode==='guest'||canEdit(role);

  const notify=useCallback((m:string)=>{setToast(m);setTimeout(()=>setToast(''),2800)},[]);

  const loadCloud=useCallback(async(currentUser:User)=>{if(!supabase)return;setCloudBusy(true);
    const [{data:pRows,error:pErr},{data:prof}]=await Promise.all([supabase.from('projects').select('*').order('updated_at',{ascending:false}),supabase.from('profiles').select('*').eq('user_id',currentUser.id).maybeSingle()]);
    if(pErr){notify(pErr.message);setCloudBusy(false);return;}
    const ps=(pRows??[]) as Project[];
    const memberships=ps.length?await supabase.from('project_members').select('project_id,role').in('project_id',ps.map(p=>p.id)):({data:[]} as const);
    const membershipRows=(memberships.data??[]) as Array<{project_id:string;role:Role}>;
    const roleMap=new Map(membershipRows.map(m=>[m.project_id,m.role])); ps.forEach(p=>p.role=(roleMap.get(p.id)??(p.owner_id===currentUser.id?'owner':'viewer')) as Role);
    const cloudProfile=prof as Profile|null;
    setProjects(ps);setProfile(cloudProfile);setProfileName(cloudProfile?.display_name??'Creator');setProfileBio(cloudProfile?.bio??'');setProfileAvatar(cloudProfile?.avatar_url??'');
    const target=activeProjectId&&ps.some(p=>p.id===activeProjectId)?activeProjectId:ps[0]?.id??'';setActiveProjectId(target);
    if(target){const [{data:ss},{data:nn},{data:gg}]=await Promise.all([supabase.from('sections').select('*').eq('project_id',target).order('position'),supabase.from('notes').select('*').eq('project_id',target).order('position'),supabase.from('myria_goals').select('*').eq('project_id',target).order('created_at',{ascending:false})]);setSections((ss??[]) as Section[]);setNotes((nn??[]) as Note[]);setActiveSectionId((ss?.[0] as Section|undefined)?.id??'');const goalRows=(gg??[]) as Array<{id:string;title?:string|null;goal:string;description:string;reason:string;priority:number;status:string}>;setGoals(goalRows.map(g=>({id:g.id,title:g.title||g.goal,description:g.description,reason:g.reason,priority:g.priority,status:g.status,tasks:[]})));}
    setCloudBusy(false);
  },[activeProjectId,notify]);

  useEffect(()=>{if(!supabase){setBooted(true);return;}supabase.auth.getSession().then(({data})=>{setUser(data.session?.user??null);if(data.session){setMode('account');loadCloud(data.session.user);}setBooted(true)});const {data}=supabase.auth.onAuthStateChange((_event,s)=>{setUser(s?.user??null);if(s){setMode('account');queueMicrotask(()=>loadCloud(s.user));}else{setMode(null);}});return()=>data.subscription.unsubscribe();},[loadCloud]);
  useEffect(()=>{if(mode==='guest'&&guest)saveGuestState(guest)},[guest,mode]);
  useEffect(()=>{if(mode==='guest'&&guest){setProjects(guest.projects);setSections(guest.sections);setNotes(guest.notes);setActiveProjectId(guest.activeProjectId);setProfile({user_id:'guest',display_name:guest.profile.display_name,bio:guest.profile.bio});setGoals(guest.goals)}},[guest,mode]);
  useEffect(()=>{if(projectSections.length&&!projectSections.some(s=>s.id===activeSectionId))setActiveSectionId(projectSections[0].id)},[projectSections,activeSectionId]);
  useEffect(()=>{if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>undefined)},[]);

  function enterGuest(){const state=loadGuestState();setGuest(state);setMode('guest');sessionStorage.setItem('reforge-guest','1');}
  async function switchProject(id:string){setActiveProjectId(id);if(mode==='guest'&&guest){setGuest({...guest,activeProjectId:id});return;}if(supabase){setCloudBusy(true);const [{data:ss},{data:nn},{data:gg}]=await Promise.all([supabase.from('sections').select('*').eq('project_id',id).order('position'),supabase.from('notes').select('*').eq('project_id',id).order('position'),supabase.from('myria_goals').select('*').eq('project_id',id).order('created_at',{ascending:false})]);setSections((ss??[]) as Section[]);setNotes((nn??[]) as Note[]);setActiveSectionId((ss?.[0] as Section|undefined)?.id??'');const goalRows=(gg??[]) as Array<{id:string;title?:string|null;goal:string;description:string;reason:string;priority:number;status:string}>;setGoals(goalRows.map(g=>({id:g.id,title:g.title||g.goal,description:g.description,reason:g.reason,priority:g.priority,status:g.status,tasks:[]})));setCloudBusy(false)}}
  async function createProject(){const title=prompt('Project title')?.trim();if(!title)return;if(mode==='guest'&&guest){const next=newGuestProject(guest,title);setGuest(next);notify('Project created locally.');return;}if(supabase&&user){const {data,error}=await supabase.from('projects').insert({owner_id:user.id,title,description:''}).select().single();if(error){notify(error.message);return;}await loadCloud(user);if(data)await switchProject(data.id);notify('Cloud project created.')}}
  async function addSection(e:FormEvent){e.preventDefault();const title=sectionTitle.trim();if(!title||!activeProjectId)return;const section:Section={id:uid(),project_id:activeProjectId,title,slug:slugify(title)||`section-${Date.now()}`,position:projectSections.length,is_system:false,created_by:user?.id};if(mode==='guest'&&guest){setGuest({...guest,sections:[...guest.sections,section]});setActiveSectionId(section.id);}else if(supabase&&user){const {data,error}=await supabase.from('sections').insert({...section,id:undefined,created_by:user.id}).select().single();if(error){notify(error.message);return;}setSections(v=>[...v,data as Section]);setActiveSectionId(data.id);}setSectionTitle('');setModal(null);notify('Section added.');}
  async function addNote(e:FormEvent){e.preventDefault();if(!activeProjectId||!newBody.trim())return;const target=inferSection(newBody,projectSections)??activeSection?.id;const targetSection=projectSections.find(s=>s.id===target);const note:Note={id:uid(),project_id:activeProjectId,author_id:user?.id,section_id:target,title:newTitle.trim()||'Untitled fragment',body:newBody.trim(),category:targetSection?.title??'Brainstorming',position:notes.filter(n=>n.section_id===target).length};if(mode==='guest'&&guest){setGuest(upsertGuestNote(guest,note));}else if(supabase&&user){const {data,error}=await supabase.from('notes').insert({...note,id:undefined,author_id:user.id}).select().single();if(error){notify(error.message);return;}setNotes(v=>[...v,data as Note]);}setNewTitle('');setNewBody('');setModal(null);if(target)setActiveSectionId(target);notify(`Saved to ${targetSection?.title??'the project'}.`);}
  function updateNoteDraft(id:string,patch:Partial<Note>){setNotes(current=>current.map(n=>n.id===id?{...n,...patch}:n));if(mode==='guest'&&guest){const old=guest.notes.find(n=>n.id===id);if(old)setGuest(upsertGuestNote(guest,{...old,...patch}));return;}if(!supabase)return;clearTimeout(saveTimers.current[id]);saveTimers.current[id]=setTimeout(async()=>{const {error}=await supabase!.from('notes').update(patch).eq('id',id);if(error)notify(`Autosave failed: ${error.message}`);},650)}
  async function deleteNote(id:string){if(!confirm('Delete this note?'))return;if(mode==='guest'&&guest){setGuest({...guest,notes:guest.notes.filter(n=>n.id!==id)});}else if(supabase){const {error}=await supabase.from('notes').delete().eq('id',id);if(error){notify(error.message);return;}setNotes(v=>v.filter(n=>n.id!==id));}}
  async function dropNote(noteId:string,targetSectionId:string){if(!editable)return;const section=projectSections.find(s=>s.id===targetSectionId);updateNoteDraft(noteId,{section_id:targetSectionId,category:section?.title??'Custom'});setActiveSectionId(targetSectionId);notify(`Moved to ${section?.title}.`)}

  async function saveProfile(e:FormEvent){e.preventDefault();if(mode==='guest'&&guest){setGuest({...guest,profile:{display_name:profileName,bio:profileBio}});setProfile(p=>p?{...p,display_name:profileName,bio:profileBio}:p);}else if(supabase&&user){const {error}=await supabase.from('profiles').update({display_name:profileName,bio:profileBio,avatar_url:profileAvatar||null,updated_at:new Date().toISOString()}).eq('user_id',user.id);if(error){notify(error.message);return;}setProfile(p=>p?{...p,display_name:profileName,bio:profileBio,avatar_url:profileAvatar}:p);}setModal(null);notify('Profile saved.');}
  async function invite(e:FormEvent){e.preventDefault();if(!supabase||!user||!inviteEmail.trim())return;const {error}=await supabase.from('project_invites').insert({project_id:activeProjectId,email:inviteEmail.trim().toLowerCase(),role:inviteRole,invited_by:user.id});if(error){notify(error.message);return;}setInviteEmail('');notify('Collaboration invite created. They can accept it after signing in with that email.');}
  async function acceptInvites(){if(!supabase||!user)return;const {data,error}=await supabase.from('project_invites').select('*').eq('status','pending');if(error){notify(error.message);return;}if(!data?.length){notify('No pending invites for this account.');return;}for(const inv of data){await supabase.rpc('accept_project_invite',{invite_id:inv.id});}await loadCloud(user);notify(`${data.length} invite${data.length===1?'':'s'} accepted.`)}

  const projectContext=()=>({project:activeProject?{title:activeProject.title,description:activeProject.description}:null,sections:projectSections.map(s=>s.title),notes:notes.filter(n=>n.project_id===activeProjectId).slice(0,80).map(n=>({title:n.title,body:n.body,category:n.category})),goals:goals.slice(0,8).map(g=>({title:g.title,status:g.status}))});
  async function persistGoal(suggestion:{title:string;description:string;reason:string;priority:number;tasks:{description:string;riskLevel:'low'|'medium'|'high'}[]}){const goal:MyriaGoal={id:uid(),title:suggestion.title,description:suggestion.description,reason:suggestion.reason,priority:suggestion.priority,status:'planned',tasks:suggestion.tasks.map(t=>({id:uid(),description:t.description,status:'planned',riskLevel:t.riskLevel,attempts:0,maxAttempts:3}))};setGoals(v=>[goal,...v]);if(mode==='guest'&&guest){setGuest(addGuestGoal(guest,goal));return;}if(supabase&&user){const {data:g,error}=await supabase.from('myria_goals').insert({user_id:user.id,project_id:activeProjectId,goal:goal.title,title:goal.title,description:goal.description,reason:goal.reason,priority:goal.priority,status:'planned'}).select().single();if(error)return;for(const task of goal.tasks){await supabase.from('myria_tasks').insert({goal_id:g.id,project_id:activeProjectId,user_id:user.id,description:task.description,risk_level:task.riskLevel,status:'planned',attempts:0,max_attempts:3})}}}
  async function sendMyria(e?:FormEvent,override?:string){e?.preventDefault();const text=(override??chat).trim();if(!text)return;stopSpeech();const userMsg:MyriaMessage={id:uid(),role:'user',content:text,createdAt:Date.now()};const next=[...messages,userMsg];setMessages(next);setChat('');setMyriaStatus('thinking');
    try{const res=await fetch('/api/myria',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:text,context:projectContext(),history:next.slice(-10).map(m=>({role:m.role,content:m.content}))})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Myria is unavailable.');const a:MyriaMessage={id:uid(),role:'assistant',content:data.message,createdAt:Date.now()};setMessages(v=>[...v,a]);if(data.suggestion)await persistGoal(data.suggestion);setMyriaStatus('idle');if(!muted)queueSpeech(data.message);}catch(err){setMyriaStatus('error');const m=err instanceof Error?err.message:'Myria is unavailable.';setMessages(v=>[...v,{id:uid(),role:'assistant',content:`I can't reach my reasoning service right now. ${m}`,createdAt:Date.now()}]);}}
  function stopSpeech(){speechQueue.current=[];voiceAbort.current?.abort();voiceAbort.current=null;if(audioRef.current){audioRef.current.pause();audioRef.current.src='';audioRef.current=null;}speakingRef.current=false;if(myriaStatus==='talking')setMyriaStatus('idle');}
  function queueSpeech(text:string){speechQueue.current.push(text);void processSpeechQueue()}
  async function processSpeechQueue(){if(speakingRef.current||muted||!speechQueue.current.length)return;speakingRef.current=true;setMyriaStatus('talking');const text=speechQueue.current.shift()!;const controller=new AbortController();voiceAbort.current=controller;try{const res=await fetch('/api/voice',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text}),signal:controller.signal});if(!res.ok)throw new Error();const blob=await res.blob();const url=URL.createObjectURL(blob);const audio=new Audio(url);audioRef.current=audio;await audio.play();await new Promise<void>(resolve=>{audio.onended=()=>resolve();audio.onerror=()=>resolve()});URL.revokeObjectURL(url);}catch{}finally{speakingRef.current=false;audioRef.current=null;if(speechQueue.current.length&&!muted)void processSpeechQueue();else setMyriaStatus('idle')}}
  function toggleMute(){const next=!muted;setMuted(next);if(next)stopSpeech();}

  if(!booted)return <div className="loading"><Petals/><div className="gate-mark">R</div><p>Heating the forge…</p></div>;
  if(!mode)return <AuthGate onGuest={enterGuest}/>;

  return <div className="shell"><Petals/><header className="topbar">
    <div className="brand"><div className="brand-mark">R</div><div><strong>REFORGE</strong><span>STORIES ARE MADE, THEN REMADE.</span></div></div>
    <div className="top-actions"><span className="sync">{mode==='account'?<><Cloud size={14}/> Cloud</>:<><CloudOff size={14}/> Guest</>}</span><button className="icon-btn" onClick={()=>setModal('collab')} title="Collaboration"><Users size={18}/></button><button className="profile-btn" onClick={()=>setModal('profile')}>{profile?.avatar_url?<img src={profile.avatar_url} alt=""/>:<CircleUserRound size={20}/>}<span>{profile?.display_name??'Creator'}</span><ChevronDown size={14}/></button></div>
  </header>

  <main className="main">
    <section className="project-rail glass"><div><span className="label">Active project</span><select value={activeProjectId} onChange={e=>switchProject(e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></div><button className="ghost" onClick={createProject}><Plus size={15}/> New Project</button><button className="ghost" onClick={()=>setModal('section')} disabled={!editable}><Plus size={15}/> Custom Section</button><div className="rail-spacer"/><span className="save-state"><Save size={14}/>{cloudBusy?'Syncing…':'Autosave on'}</span></section>

    <section className="hero glass"><p className="eyebrow">THE CRIMSON ARCHIVE · {mode==='guest'?'LOCAL':'CLOUD'}</p><h1>{activeProject?.title??'Your story begins here.'}</h1><p>{activeProject?.description||'Turn fragments into a world with structure, memory, and a persistent creative partner at your side.'}</p><div className="hero-rule"/></section>

    <nav className="section-nav glass" aria-label="Story sections">{projectSections.map(s=><button key={s.id} className={activeSection?.id===s.id?'active':''} onClick={()=>setActiveSectionId(s.id)} onDragOver={e=>editable&&e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/reforge-note');if(id)void dropNote(id,s.id)}}>{s.title}<span>{notes.filter(n=>n.section_id===s.id).length}</span></button>)}</nav>

    <div className="workspace-grid">
      <section className="content-panel glass"><div className="panel-head"><div><p className="eyebrow">CURRENT SECTION</p><h2>{activeSection?.title??'Workspace'}</h2><p>{editable?'Edit freely. Changes autosave as you type. Drag notes onto section tabs to reorganize.':'Viewer access — this project is read only.'}</p></div><button className="primary" disabled={!editable} onClick={()=>setModal('note')}><Plus size={16}/> Add Note</button></div>
        <div className="notes-grid">{sectionNotes.length?sectionNotes.map(note=><article key={note.id} className="note-card" draggable={editable} onDragStart={e=>{e.dataTransfer.setData('text/reforge-note',note.id);e.dataTransfer.effectAllowed='move'}}><div className="drag"><GripVertical size={16}/></div><input className="note-title" value={note.title} readOnly={!editable} onChange={e=>updateNoteDraft(note.id,{title:e.target.value})}/><textarea className="note-body" value={note.body} readOnly={!editable} onChange={e=>updateNoteDraft(note.id,{body:e.target.value})}/><div className="note-foot"><span>{note.category}</span>{editable&&<button onClick={()=>deleteNote(note.id)}>Delete</button>}</div></article>):<div className="empty"><BookOpen size={34}/><strong>No fragments here yet.</strong><span>Add a note. Reforge routes new notes by their content, not their title.</span></div>}</div>
      </section>

      <aside className="myria glass"><div className="myria-head"><div className={`myria-orb ${myriaStatus}`}><Bot size={24}/></div><div><p className="eyebrow">PROJECT ASSISTANT</p><h2>MYRIA</h2><span className="status-line">{myriaStatus==='thinking'?'Thinking…':myriaStatus==='talking'?'Speaking…':myriaStatus==='error'?'Text service unavailable':'Observing quietly'}</span></div><button className="icon-btn" onClick={toggleMute} title={muted?'Unmute Myria':'Mute Myria'}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button></div>
        <div className="chat-log">{messages.map(m=><div key={m.id} className={`bubble ${m.role}`}><small>{m.role==='assistant'?'Myria':'You'}</small>{m.content}</div>)}</div>
        <form className="chat-form" onSubmit={sendMyria}><input value={chat} onChange={e=>setChat(e.target.value)} onFocus={()=>setMyriaStatus('observing')} onBlur={()=>myriaStatus==='observing'&&setMyriaStatus('idle')} placeholder="Ask Myria about the project…"/><button className="send-btn" aria-label="Send"><Sparkles size={17}/></button></form>
        <div className="quick-actions"><button onClick={()=>sendMyria(undefined,'Scan this project and identify the single most useful next creative action.')}><Sparkles size={14}/> Project scan</button><button onClick={()=>sendMyria(undefined,'Summarize the current project from the notes, including unresolved contradictions or gaps.')}><BookOpen size={14}/> Summarize</button></div>
        <div className="goals"><div className="subhead"><strong>Myria goals</strong><span>{goals.length}</span></div>{goals.slice(0,4).map(g=><div className="goal" key={g.id}><span>{g.status}</span><strong>{g.title}</strong><p>{g.reason}</p></div>)}{!goals.length&&<p className="muted-copy">Structured suggestions will appear here when a useful next step is clear.</p>}</div>
      </aside>
    </div>
  </main>

  {modal==='note'&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setModal(null)}><form className="modal" onSubmit={addNote}><button type="button" className="close" onClick={()=>setModal(null)}><X/></button><p className="eyebrow">ADD FRAGMENT</p><h2>New note</h2><label>Title<input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Optional label"/></label><label>Content<textarea required value={newBody} onChange={e=>setNewBody(e.target.value)} placeholder="Write the actual idea here. Reforge uses these words to choose the section."/></label><p className="hint">Routing is inferred from the note body, not the title.</p><button className="primary wide">Save note</button></form></div>}
  {modal==='section'&&<div className="modal-backdrop"><form className="modal small" onSubmit={addSection}><button type="button" className="close" onClick={()=>setModal(null)}><X/></button><p className="eyebrow">CUSTOMIZE THE FORGE</p><h2>Add section</h2><label>Section name<input required value={sectionTitle} onChange={e=>setSectionTitle(e.target.value)} placeholder="Relationships, Timeline, Factions…"/></label><button className="primary wide">Create section</button></form></div>}
  {modal==='profile'&&<div className="modal-backdrop"><form className="modal" onSubmit={saveProfile}><button type="button" className="close" onClick={()=>setModal(null)}><X/></button><p className="eyebrow">PROFILE</p><h2>{mode==='guest'?'Local creator':'Account profile'}</h2><label>Display name<input value={profileName} onChange={e=>setProfileName(e.target.value)}/></label>{mode==='account'&&<label>Avatar URL<input value={profileAvatar} onChange={e=>setProfileAvatar(e.target.value)} placeholder="https://…"/></label>}<label>Bio<textarea value={profileBio} onChange={e=>setProfileBio(e.target.value)}/></label><button className="primary wide">Save profile</button>{mode==='account'&&<button type="button" className="ghost wide" onClick={async()=>{await supabase?.auth.signOut();setMode(null)}}><LogIn size={16}/> Sign out</button>}</form></div>}
  {modal==='collab'&&<div className="modal-backdrop"><div className="modal"><button className="close" onClick={()=>setModal(null)}><X/></button><p className="eyebrow">COLLABORATION</p><h2>Project room</h2>{mode==='guest'?<div className="notice"><CloudOff/><div><strong>Guest projects are private to this device.</strong><p>Create an account to sync and invite collaborators.</p></div></div>:<><p className="hint">Invite someone by the email they use for Reforge. Owners and editors can invite; project permissions are enforced by the database.</p><form onSubmit={invite} className="invite-form"><input type="email" required value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="collaborator@example.com"/><select value={inviteRole} onChange={e=>setInviteRole(e.target.value as 'editor'|'viewer')}><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button className="primary" disabled={!editable}>Invite</button></form><button className="ghost wide" onClick={acceptInvites}>Check & accept my pending invites</button><div className="permission-card"><strong>Your role: {role}</strong><p>{role==='owner'?'Full project authority.':role==='editor'?'Can write, organize, and collaborate.':'Read-only access.'}</p></div></>}</div></div>}
  {toast&&<div className="toast">{toast}</div>}
  </div>
}
