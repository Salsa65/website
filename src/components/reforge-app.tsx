'use client';

import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import type {Session,User} from '@supabase/supabase-js';
import {getSupabase} from '@/lib/supabase';
import {deriveLocalPlan} from '@/lib/myria';
import {loadGuests,newGuestProject,saveGuests,sortNotes} from '@/lib/guest';
import type {ChatMessage,GuestProject,MyriaState,Note,Profile,Project,Section} from '@/lib/types';

type Mode='boot'|'auth'|'guest'|'cloud';
type AuthView='signin'|'signup'|'admin';
const uid=()=>crypto.randomUUID();
const nowPos=(notes:Note[],sectionId:string)=>Math.max(-1,...notes.filter(n=>n.section_id===sectionId).map(n=>n.position))+1;
const clean=(s:string)=>s.trim();

export default function ReforgeApp(){
 const supabase=useMemo(()=>getSupabase(),[]);
 const [mode,setMode]=useState<Mode>('boot');
 const [authView,setAuthView]=useState<AuthView>('signin');
 const [session,setSession]=useState<Session|null>(null);
 const [user,setUser]=useState<User|null>(null);
 const [profile,setProfile]=useState<Profile|null>(null);
 const [projects,setProjects]=useState<Project[]>([]);
 const [projectId,setProjectId]=useState('');
 const [sections,setSections]=useState<Section[]>([]);
 const [notes,setNotes]=useState<Note[]>([]);
 const [activeSectionId,setActiveSectionId]=useState('');
 const [guestProjects,setGuestProjects]=useState<GuestProject[]>([]);
 const [chat,setChat]=useState<ChatMessage[]>([{id:'hello',role:'assistant',content:'I’m Myria. Give me the part of the story that is resisting you, and I’ll help find the pressure point.'}]);
 const [myriaState,setMyriaState]=useState<MyriaState>('IDLE');
 const [muted,setMuted]=useState(false);
 const [chatInput,setChatInput]=useState('');
 const [authError,setAuthError]=useState('');
 const [toast,setToast]=useState('');
 const [noteModal,setNoteModal]=useState<{open:boolean;note?:Note}>({open:false});
 const [sectionModal,setSectionModal]=useState(false);
 const [profileModal,setProfileModal]=useState(false);
 const [collabModal,setCollabModal]=useState(false);
 const [goalsOpen,setGoalsOpen]=useState(false);
 const [goals,setGoals]=useState<any[]>([]);
 const [tasks,setTasks]=useState<any[]>([]);
 const [dragId,setDragId]=useState<string|null>(null);
 const audioRef=useRef<HTMLAudioElement|null>(null);
 const speechAbort=useRef<AbortController|null>(null);
 const currentProject=projects.find(p=>p.id===projectId) || (mode==='guest'?guestProjects.find(p=>p.id===projectId):undefined);
 const activeSection=sections.find(s=>s.id===activeSectionId);
 const visibleNotes=sortNotes(notes.filter(n=>n.section_id===activeSectionId));

 const notify=(m:string)=>{setToast(m);window.setTimeout(()=>setToast(''),2600)};

 useEffect(()=>{
  if(!supabase){const guests=loadGuests();setGuestProjects(guests);setMode('auth');return;}
  supabase.auth.getSession().then(({data})=>{
    setSession(data.session);setUser(data.session?.user??null);setMode(data.session?'cloud':'auth');
  });
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s);setUser(s?.user??null);setMode(s?'cloud':'auth');});
  return()=>subscription.unsubscribe();
 },[supabase]);

 useEffect(()=>{if(mode==='cloud'&&user)loadCloud();},[mode,user?.id]);
 useEffect(()=>{if(mode==='guest'){const g=guestProjects.find(p=>p.id===projectId);if(g){setSections(g.sections);setNotes(g.notes);if(!activeSectionId||!g.sections.some(s=>s.id===activeSectionId))setActiveSectionId(g.sections[0]?.id||'');}}},[mode,projectId,guestProjects]);

 useEffect(()=>{
  if(mode!=='cloud'||!supabase||!projectId)return;
  const channel=supabase.channel(`reforge-${projectId}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'notes',filter:`project_id=eq.${projectId}`},()=>loadProjectData(projectId))
   .on('postgres_changes',{event:'*',schema:'public',table:'sections',filter:`project_id=eq.${projectId}`},()=>loadProjectData(projectId))
   .subscribe();
  return()=>{supabase.removeChannel(channel)};
 },[mode,projectId,supabase]);

 async function loadCloud(){
  if(!supabase||!user)return;
  const [{data:pdata},{data:pr,error}]=await Promise.all([
   supabase.from('profiles').select('*').eq('user_id',user.id).maybeSingle(),
   supabase.from('projects').select('*').order('updated_at',{ascending:false})
  ]);
  if(pdata)setProfile(pdata as Profile);
  if(error){notify(error.message);return;}
  let list=(pr||[]) as Project[];
  if(!list.length){const {data:newp,error:e}=await supabase.from('projects').insert({owner_id:user.id,title:'My Reforge Project',description:''}).select().single();if(e){notify(e.message);return;}list=[newp as Project];}
  setProjects(list);const pid=projectId&&list.some(p=>p.id===projectId)?projectId:list[0].id;setProjectId(pid);await loadProjectData(pid);await loadMyriaState(pid);
 }
 async function loadProjectData(pid:string){
  if(!supabase)return;
  const [{data:s,error:se},{data:n,error:ne}]=await Promise.all([
   supabase.from('sections').select('*').eq('project_id',pid).order('position'),
   supabase.from('notes').select('*').eq('project_id',pid).order('position')
  ]);
  if(se||ne){notify((se||ne)!.message);return;}
  const ss=(s||[]) as Section[];setSections(ss);setNotes((n||[]) as Note[]);setActiveSectionId(v=>ss.some(x=>x.id===v)?v:(ss[0]?.id||''));
 }
 async function loadMyriaState(pid:string){
  if(!supabase)return;
  const [{data:g},{data:t}]=await Promise.all([supabase.from('myria_goals').select('*').eq('project_id',pid).order('created_at',{ascending:false}).limit(30),supabase.from('myria_tasks').select('*').eq('project_id',pid).order('created_at',{ascending:false}).limit(60)]);
  setGoals(g||[]);setTasks(t||[]);
 }

 function persistGuest(updatedSections=sections,updatedNotes=notes){
  const next=guestProjects.map(g=>g.id===projectId?{...g,sections:updatedSections,notes:updatedNotes}:g);setGuestProjects(next);saveGuests(next);
 }
 function continueGuest(){let gs=loadGuests();if(!gs.length){gs=[newGuestProject('Guest Reforge Project')];saveGuests(gs);}setGuestProjects(gs);setProjects(gs.map(g=>({id:g.id,title:g.title,description:g.description})));setProjectId(gs[0].id);setMode('guest');}

 async function authSubmit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!supabase)return setAuthError('Cloud authentication is unavailable until Supabase environment variables are configured.');
  const fd=new FormData(e.currentTarget);const email=String(fd.get('email')||'');const password=String(fd.get('password')||'');setAuthError('');
  if(authView==='signup'){
    const display_name=String(fd.get('display_name')||'Creator');const {error}=await supabase.auth.signUp({email,password,options:{data:{display_name}}});if(error)return setAuthError(error.message);notify('Account created. You can sign in when your account is ready.');setAuthView('signin');
  }else{
    const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)return setAuthError(error.message);
    if(authView==='admin'){
      const {data:p}=await supabase.from('profiles').select('role').eq('user_id',data.user.id).single();if(p?.role!=='admin'){await supabase.auth.signOut();return setAuthError('This account is not an administrator.');}
    }
  }
 }
 async function signOut(){stopSpeech();if(supabase)await supabase.auth.signOut();setProjects([]);setProjectId('');setSections([]);setNotes([]);setProfile(null);setMode('auth');}

 async function addProject(){
  const title=prompt('Project name');if(!title?.trim())return;
  if(mode==='guest'){const g=newGuestProject(title.trim());const next=[...guestProjects,g];setGuestProjects(next);saveGuests(next);setProjects(next.map(x=>({id:x.id,title:x.title,description:x.description})));setProjectId(g.id);return;}
  if(!supabase||!user)return;const {data,error}=await supabase.from('projects').insert({owner_id:user.id,title:title.trim(),description:''}).select().single();if(error)return notify(error.message);setProjects(p=>[data as Project,...p]);setProjectId(data.id);await loadProjectData(data.id);
 }
 async function switchProject(id:string){setProjectId(id);if(mode==='cloud'){await loadProjectData(id);await loadMyriaState(id);}}

 async function saveNoteFromForm(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!activeSectionId||!currentProject)return;const fd=new FormData(e.currentTarget);const title=clean(String(fd.get('title')||''))||'Untitled fragment';const body=clean(String(fd.get('body')||''));if(!body)return notify('Write something in the note first.');
  const existing=noteModal.note;
  if(mode==='guest'){
   const next=existing?notes.map(n=>n.id===existing.id?{...n,title,body}:n):[...notes,{id:uid(),project_id:projectId,section_id:activeSectionId,title,body,category:activeSection?.title||'Ideas',position:nowPos(notes,activeSectionId)}];setNotes(next);persistGuest(sections,next);setNoteModal({open:false});return;
  }
  if(!supabase||!user)return;
  if(existing){const {error}=await supabase.from('notes').update({title,body}).eq('id',existing.id);if(error)return notify(error.message);}else{const {error}=await supabase.from('notes').insert({project_id:projectId,section_id:activeSectionId,author_id:user.id,title,body,category:activeSection?.title||'Ideas',position:nowPos(notes,activeSectionId)});if(error)return notify(error.message);}
  setNoteModal({open:false});await loadProjectData(projectId);
 }
 async function deleteNote(note:Note){if(!confirm(`Delete “${note.title}”?`))return;if(mode==='guest'){const next=notes.filter(n=>n.id!==note.id);setNotes(next);persistGuest(sections,next);return;}if(!supabase)return;const {error}=await supabase.from('notes').delete().eq('id',note.id);if(error)notify(error.message);else loadProjectData(projectId);}
 async function addSection(e:FormEvent<HTMLFormElement>){e.preventDefault();const fd=new FormData(e.currentTarget);const title=clean(String(fd.get('title')||''));if(!title)return;const slug=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');const position=Math.max(-1,...sections.map(s=>s.position))+1;
  if(mode==='guest'){const s:Section={id:uid(),project_id:projectId,title,slug,position,is_system:false};const next=[...sections,s];setSections(next);persistGuest(next,notes);setActiveSectionId(s.id);setSectionModal(false);return;}
  if(!supabase||!user)return;const {data,error}=await supabase.from('sections').insert({project_id:projectId,title,slug,position,is_system:false,created_by:user.id}).select().single();if(error)return notify(error.message);setSectionModal(false);await loadProjectData(projectId);if(data)setActiveSectionId(data.id);
 }
 async function dropOn(targetId:string){if(!dragId||dragId===targetId)return;const ordered=visibleNotes.map(n=>n.id);const from=ordered.indexOf(dragId),to=ordered.indexOf(targetId);if(from<0||to<0)return;ordered.splice(to,0,ordered.splice(from,1)[0]);const map=new Map(ordered.map((id,i)=>[id,i]));const next=notes.map(n=>map.has(n.id)?{...n,position:map.get(n.id)!}:n);setNotes(next);if(mode==='guest')persistGuest(sections,next);else if(supabase)await Promise.all(next.filter(n=>map.has(n.id)).map(n=>supabase.from('notes').update({position:n.position}).eq('id',n.id)));setDragId(null);}

 async function saveProfile(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase||!user)return;const fd=new FormData(e.currentTarget);const display_name=clean(String(fd.get('display_name')||''))||'Creator';const bio=clean(String(fd.get('bio')||''));const {data,error}=await supabase.from('profiles').update({display_name,bio,updated_at:new Date().toISOString()}).eq('user_id',user.id).select().single();if(error)return notify(error.message);setProfile(data as Profile);setProfileModal(false);}
 async function invite(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase||!user)return;const fd=new FormData(e.currentTarget);const email=clean(String(fd.get('email')||'')).toLowerCase();const role=String(fd.get('role')||'editor');const {error}=await supabase.from('project_invites').insert({project_id:projectId,email,role,invited_by:user.id});if(error)return notify(error.message);notify('Invite recorded. They can accept it after signing in with that email.');(e.currentTarget as HTMLFormElement).reset();}
 async function acceptPendingInvites(){if(!supabase||!user?.email)return;const {data}=await supabase.from('project_invites').select('*').eq('email',user.email.toLowerCase()).eq('status','pending');for(const i of data||[]){await supabase.rpc('accept_project_invite',{invite_id:i.id});}await loadCloud();notify('Pending invitations checked.');}

 function stopSpeech(){speechAbort.current?.abort();speechAbort.current=null;if(audioRef.current){audioRef.current.pause();audioRef.current.src='';audioRef.current=null;}setMyriaState(muted?'MUTED':'IDLE');}
 async function speak(text:string){if(muted)return;stopSpeech();const ctrl=new AbortController();speechAbort.current=ctrl;try{const r=await fetch('/api/speech',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text}),signal:ctrl.signal});if(!r.ok)return;const blob=await r.blob();const url=URL.createObjectURL(blob);const a=new Audio(url);audioRef.current=a;setMyriaState('TALKING');a.onended=()=>{URL.revokeObjectURL(url);audioRef.current=null;setMyriaState('IDLE')};a.onerror=()=>setMyriaState('IDLE');await a.play();}catch{if(!ctrl.signal.aborted)setMyriaState('IDLE');}}
 async function sendMyria(e?:FormEvent){e?.preventDefault();const message=chatInput.trim();if(!message||!currentProject)return;stopSpeech();const userMsg:ChatMessage={id:uid(),role:'user',content:message};setChat(c=>[...c,userMsg]);setChatInput('');setMyriaState('THINKING');try{const payload={message,project:{title:currentProject.title,activeSection:activeSection?.title||'Workspace',notes:notes.map(n=>({title:n.title,body:n.body,section:sections.find(s=>s.id===n.section_id)?.title||n.category}))},history:chat.slice(-12).map(m=>({role:m.role,content:m.content}))};const r=await fetch('/api/myria',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const data=await r.json();if(!r.ok)throw new Error(data.error||'Myria failed');const reply=String(data.reply);const msg:ChatMessage={id:uid(),role:'assistant',content:reply};setChat(c=>[...c,msg]);setMyriaState('IDLE');if(mode==='cloud'&&supabase&&user){await supabase.from('myria_conversations').insert([{project_id:projectId,user_id:user.id,role:'user',content:message},{project_id:projectId,user_id:user.id,role:'assistant',content:reply}]);}if(!muted)speak(reply);}catch(err){setMyriaState('ERROR');setChat(c=>[...c,{id:uid(),role:'assistant',content:`I hit a connection problem: ${err instanceof Error?err.message:'unknown error'}. Your writing is still safe.`}]);}}
 async function createSuggestedGoal(){const counts=Object.fromEntries(sections.map(s=>[s.title,notes.filter(n=>n.section_id===s.id).length]));const plan=deriveLocalPlan(counts);if(mode!=='cloud'||!supabase||!user){notify(`${plan.goal}: ${plan.tasks.join(' • ')}`);return;}const {data:g,error}=await supabase.from('myria_goals').insert({user_id:user.id,project_id:projectId,goal:plan.goal,title:plan.goal,description:plan.understanding,reason:plan.observation,priority:40,status:'planned'}).select().single();if(error)return notify(error.message);if(g){await supabase.from('myria_tasks').insert(plan.tasks.map(description=>({goal_id:g.id,project_id:projectId,user_id:user.id,description,status:'planned',risk_level:'low',expected_result:description,attempts:0,max_attempts:3})));}await loadMyriaState(projectId);setGoalsOpen(true);}

 if(mode==='boot')return <div className="boot"><div className="forge-mark">R</div><p>Igniting Reforge…</p></div>;
 if(mode==='auth')return <AuthScreen view={authView} setView={setAuthView} onSubmit={authSubmit} onGuest={continueGuest} error={authError} cloudReady={Boolean(supabase)}/>;

 return <div className="site-shell">
  <Petals/>
  <header className="topbar">
   <div className="brand"><div className="brand-rune">R</div><div><b>REFORGE</b><span>STORY WORKSHOP</span></div></div>
   <div className="project-switch"><select value={projectId} onChange={e=>switchProject(e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select><button onClick={addProject}>＋ Project</button></div>
   <div className="account-actions"><span className={`sync-dot ${mode}`}></span><span>{mode==='guest'?'Guest · local only':profile?.display_name||user?.email||'Creator'}</span>{mode==='cloud'&&<button onClick={()=>setProfileModal(true)}>Profile</button>}<button onClick={signOut}>{mode==='guest'?'Exit guest':'Sign out'}</button></div>
  </header>

  <main className="continuous-page">
   <section className="hero-section">
    <div><span className="eyebrow">THE CRIMSON ARCHIVE · REFORGED</span><h1>{currentProject?.title||'Reforge'}</h1><p>One workspace for the ideas, systems, people and pages that make your world worth returning to.</p></div>
    <div className="hero-actions"><button className="primary" onClick={()=>setNoteModal({open:true})}>＋ New note</button><button onClick={createSuggestedGoal}>Myria: inspect project</button>{mode==='cloud'&&<button onClick={()=>setCollabModal(true)}>Collaborate</button>}</div>
   </section>

   <section className="section-rail" aria-label="Story sections">
    {sections.map(s=><button key={s.id} className={s.id===activeSectionId?'active':''} onClick={()=>setActiveSectionId(s.id)}><span>{s.title}</span><small>{notes.filter(n=>n.section_id===s.id).length}</small></button>)}
    <button className="add-section" onClick={()=>setSectionModal(true)}>＋ Custom section</button>
   </section>

   <section className="workspace-grid">
    <div className="notes-panel panel">
     <div className="panel-head"><div><span className="eyebrow">ACTIVE SECTION</span><h2>{activeSection?.title||'Workspace'}</h2></div><button className="primary" onClick={()=>setNoteModal({open:true})}>＋ Add note</button></div>
     <div className="note-list">
      {!visibleNotes.length&&<div className="empty-state"><div>✦</div><h3>Nothing forged here yet.</h3><p>Start with one useful fragment. Reforge autosaves the result.</p><button onClick={()=>setNoteModal({open:true})}>Create the first note</button></div>}
      {visibleNotes.map(n=><article className="note-card" key={n.id} draggable onDragStart={()=>setDragId(n.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>dropOn(n.id)}>
       <div className="drag">⠿</div><div className="note-copy"><h3>{n.title}</h3><p>{n.body}</p><span>{activeSection?.title} · autosaved</span></div><div className="note-actions"><button onClick={()=>setNoteModal({open:true,note:n})}>Edit</button><button className="danger-text" onClick={()=>deleteNote(n)}>Delete</button></div>
      </article>)}
     </div>
    </div>

    <aside className="myria panel">
     <div className="myria-head"><div className={`myria-orb ${myriaState.toLowerCase()}`}><span>M</span><i></i></div><div><span className="eyebrow">PROJECT MANAGER</span><h2>Myria</h2><p>{myriaState==='TALKING'?'Speaking':myriaState==='THINKING'?'Thinking':myriaState==='LISTENING'?'Listening':myriaState==='ERROR'?'Connection issue':muted?'Muted':'Observing'}</p></div><button title={muted?'Unmute':'Mute'} onClick={()=>{const next=!muted;setMuted(next);if(next)stopSpeech();setMyriaState(next?'MUTED':'IDLE')}}>{muted?'🔇':'🔊'}</button></div>
     <div className="agent-loop"><span>OBSERVE</span><b>→</b><span>PLAN</span><b>→</b><span>EXECUTE</span><b>→</b><span>VERIFY</span></div>
     <div className="chat-log">{chat.map(m=><div key={m.id} className={`bubble ${m.role}`}><small>{m.role==='assistant'?'MYRIA':'YOU'}</small>{m.content}</div>)}</div>
     <form className="chat-form" onSubmit={sendMyria}><textarea value={chatInput} onChange={e=>setChatInput(e.target.value)} onFocus={()=>myriaState==='IDLE'&&setMyriaState('LISTENING')} onBlur={()=>myriaState==='LISTENING'&&setMyriaState('IDLE')} placeholder="Ask Myria about this project…"/><div><button type="button" onClick={stopSpeech}>Interrupt</button><button className="primary">Send</button></div></form>
     <div className="myria-foot"><button onClick={()=>setGoalsOpen(true)}>Control center</button><span>{mode==='guest'?'Guest context · local project':'Cloud project context'}</span></div>
    </aside>
   </section>

   <section className="overview-grid">
    {sections.slice(0,6).map(s=><div key={s.id} className="mini-card" onClick={()=>setActiveSectionId(s.id)}><span>{String(notes.filter(n=>n.section_id===s.id).length).padStart(2,'0')}</span><h3>{s.title}</h3><p>{notes.find(n=>n.section_id===s.id)?.title||'Awaiting its first entry'}</p></div>)}
   </section>
   <footer><b>REFORGE</b><span>Ideas are raw material. Stories are what survive the fire.</span></footer>
  </main>

  {noteModal.open&&<Modal title={noteModal.note?'Edit note':'Forge a note'} onClose={()=>setNoteModal({open:false})}><form onSubmit={saveNoteFromForm} className="form-stack"><label>Title<input name="title" defaultValue={noteModal.note?.title||''}/></label><label>Content<textarea name="body" rows={10} defaultValue={noteModal.note?.body||''} autoFocus/></label><div className="modal-actions"><button type="button" onClick={()=>setNoteModal({open:false})}>Cancel</button><button className="primary">Save note</button></div></form></Modal>}
  {sectionModal&&<Modal title="Add custom section" onClose={()=>setSectionModal(false)}><form onSubmit={addSection} className="form-stack"><label>Section name<input name="title" autoFocus placeholder="Factions, Timeline, Relationships…"/></label><div className="modal-actions"><button type="button" onClick={()=>setSectionModal(false)}>Cancel</button><button className="primary">Add section</button></div></form></Modal>}
  {profileModal&&<Modal title="Creator profile" onClose={()=>setProfileModal(false)}><form onSubmit={saveProfile} className="form-stack"><label>Display name<input name="display_name" defaultValue={profile?.display_name||''}/></label><label>Bio<textarea name="bio" rows={5} defaultValue={profile?.bio||''}/></label><div className="modal-actions"><button type="button" onClick={()=>setProfileModal(false)}>Cancel</button><button className="primary">Save profile</button></div></form></Modal>}
  {collabModal&&<Modal title="Collaboration" onClose={()=>setCollabModal(false)}><div className="collab"><p>Invite account users into this project. Editors can create and revise; viewers can read.</p><form onSubmit={invite} className="form-stack"><label>Email<input name="email" type="email" required/></label><label>Role<select name="role"><option value="editor">Editor</option><option value="viewer">Viewer</option></select></label><button className="primary">Create invite</button></form><hr/><button onClick={acceptPendingInvites}>Check my pending invitations</button></div></Modal>}
  {goalsOpen&&<Modal wide title="Myria Control Center" onClose={()=>setGoalsOpen(false)}><div className="control-grid"><section><span className="eyebrow">STATUS</span><h3>{myriaState}</h3><p>Myria keeps reasoning, project state and voice presentation separate. High-risk actions are never auto-approved.</p><button onClick={createSuggestedGoal}>Generate project goal</button></section><section><span className="eyebrow">GOALS</span>{goals.length?goals.map(g=><div className="control-row" key={g.id}><b>{g.title||g.goal}</b><span>{g.status}</span></div>):<p>No cloud goals yet.</p>}</section><section><span className="eyebrow">TASKS</span>{tasks.length?tasks.slice(0,12).map(t=><div className="control-row" key={t.id}><b>{t.description}</b><span>{t.risk_level} · {t.status}</span></div>):<p>No tasks yet.</p>}</section></div></Modal>}
  {toast&&<div className="toast">{toast}</div>}
 </div>
}

function AuthScreen({view,setView,onSubmit,onGuest,error,cloudReady}:{view:AuthView;setView:(v:AuthView)=>void;onSubmit:(e:FormEvent<HTMLFormElement>)=>void;onGuest:()=>void;error:string;cloudReady:boolean}){
 return <div className="auth-screen"><Petals/><div className="auth-card"><div className="auth-logo">R</div><span className="eyebrow">ENTER THE WORKSHOP</span><h1>REFORGE</h1><p>Shape worlds. Break stories. Build them back stronger.</p><div className="auth-tabs"><button className={view==='signin'?'active':''} onClick={()=>setView('signin')}>Sign in</button><button className={view==='signup'?'active':''} onClick={()=>setView('signup')}>Create account</button><button className={view==='admin'?'active':''} onClick={()=>setView('admin')}>Administrator</button></div><form onSubmit={onSubmit} className="form-stack">{view==='signup'&&<label>Display name<input name="display_name" required/></label>}<label>Email<input name="email" type="email" required disabled={!cloudReady}/></label><label>Password<input name="password" type="password" minLength={8} required disabled={!cloudReady}/></label>{error&&<div className="auth-error">{error}</div>}<button className="primary" disabled={!cloudReady}>{view==='signup'?'Create account':view==='admin'?'Administrator login':'Sign in'}</button></form><div className="or"><span></span>OR<span></span></div><button className="guest-btn" onClick={onGuest}>Continue as Guest</button><small>Guest projects stay on this device. Accounts unlock cloud sync, profiles and collaboration.</small></div></div>
}
function Modal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}){return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className={`modal ${wide?'wide':''}`}><div className="modal-head"><h2>{title}</h2><button onClick={onClose}>×</button></div>{children}</div></div>}
function Petals(){return <div className="petals" aria-hidden>{Array.from({length:14},(_,i)=><i key={i} style={{left:`${(i*17)%100}%`,animationDelay:`-${(i*1.7)%14}s`,animationDuration:`${12+(i%7)*1.4}s`}}/> )}</div>}
