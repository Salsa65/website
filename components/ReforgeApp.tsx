'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Bot, ChevronDown, CircleUserRound, Cloud, CloudOff, GripVertical, LogIn, Mic, MicOff, Plus, Save, Sparkles, Users, Volume2, VolumeX, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { addGuestGoal, loadGuestState, newGuestProject, saveGuestState, upsertGuestNote } from '@/lib/guestStore';
import { canEdit, inferSection, slugify } from '@/lib/story';
import type { AuthMode, GuestState, MyriaGoal, MyriaMessage, MyriaTask, Note, Profile, Project, Role, Section } from '@/lib/types';
import type { User } from '@supabase/supabase-js';

const uid=()=>crypto.randomUUID();
type AuthTab='signin'|'signup';
type OAuthProvider='google'|'github';
type MyriaStatus='idle'|'observing'|'thinking'|'talking'|'error';
type VoiceHealth='off'|'testing'|'ready'|'fallback'|'error';
type LiveCallStatus='idle'|'connecting'|'connected'|'error';
type LiveConversationLike={
  endSession:()=>Promise<void>;
  setMicMuted:(muted:boolean)=>Promise<void>|void;
  sendContextualUpdate:(text:string)=>void;
};
function liveEventText(event:unknown){
  if(typeof event==='string')return event.trim();
  if(!event||typeof event!=='object')return '';
  const value=(event as {message?:unknown;text?:unknown;transcript?:unknown}).message
    ??(event as {text?:unknown}).text
    ??(event as {transcript?:unknown}).transcript;
  return typeof value==='string'?value.trim():'';
}
const MYRIA_WELCOME="I'm Myria, your Redbound brainstorming partner. I can help shape ideas, characters, worlds, outlines, scenes, drafts, and continuity. Enable Speak Replies for narrated answers, or start a Live Call to brainstorm with me out loud.";
const BASE_PATH=process.env.NEXT_PUBLIC_BASE_PATH||'';
const AI_ENDPOINT=`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/reforge-ai`;
const SUPABASE_PUBLIC_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'';
const MOBILE_OAUTH_REDIRECT='com.reforge.duo://oauth-callback';

function Petals(){return <div className="sakura-scene" aria-hidden><div className="sakura-canopy"/><div className="sakura-pond">{Array.from({length:7},(_,i)=><span key={i} className={"pond-ring ring-"+(i+1)}/>)}</div><div className="petals sakura-petals">{Array.from({length:34},(_,i)=><i key={i} className="sakura-petal" style={{left:`${(i*17+7)%100}%`,animationDelay:`-${(i*2.7)%18}s`,animationDuration:`${10+(i%8)*1.8}s`}} />)}</div></div>}

function AngelSky(){return <div className="angel-sky" aria-hidden>
  {Array.from({length:10},(_,i)=><span key={i} className={`sky-angel ${i%2===0?'light':'fallen'} angel-${i+1}`}>
    <span className="sky-halo"/><span className="sky-wing wing-left"/><span className="sky-body"/><span className="sky-wing wing-right"/>
  </span>)}
  <span className="sky-rift"/><span className="sky-mist mist-a"/><span className="sky-mist mist-b"/>
</div>}

function AscensionMark({compact=false}:{compact?:boolean}){return <div className={`ascension-mark ${compact?'compact':''}`} aria-label="Redbound Ascension"><span className="asc-halo"/><span className="asc-wing asc-light">❯</span><span className="asc-blade">†</span><span className="asc-wing asc-dark">❮</span></div>}

function AuthGate({onGuest,allowGuest=false}:{onGuest:()=>void;allowGuest?:boolean}){
  const [tab,setTab]=useState<AuthTab>('signin');
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [confirmPassword,setConfirmPassword]=useState(''); const [displayName,setDisplayName]=useState('');
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [message,setMessage]=useState('');

  async function finishMobileOAuth(url:string){
    if(!supabase)return;
    const parsed=new URL(url);
    const hash=new URLSearchParams(parsed.hash.replace(/^#/,''));
    const accessToken=hash.get('access_token');
    const refreshToken=hash.get('refresh_token');
    const code=parsed.searchParams.get('code');
    if(accessToken&&refreshToken){
      const {error}=await supabase.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
      if(error)throw error;
      return;
    }
    if(code){
      const {error}=await supabase.auth.exchangeCodeForSession(code);
      if(error)throw error;
    }
  }

  useEffect(()=>{
    if(!Capacitor.isNativePlatform())return;
    let active=true;
    let handle:{remove:()=>Promise<void>}|undefined;
    void App.addListener('appUrlOpen',async({url})=>{
      if(!active||!url.startsWith(MOBILE_OAUTH_REDIRECT))return;
      try{
        await Browser.close();
        await finishMobileOAuth(url);
      }catch(err){setError(err instanceof Error?err.message:'OAuth sign-in failed.');}
      finally{setBusy(false);}
    }).then(listener=>{handle=listener});
    return()=>{active=false;void handle?.remove();};
  },[]);

  async function oauth(provider:OAuthProvider){
    setError('');setMessage('');
    if(!supabase){setError('Cloud authentication is not configured on this deployment.');return;}
    setBusy(true);
    try{
      if(Capacitor.isNativePlatform()){
        const {data,error}=await supabase.auth.signInWithOAuth({provider,options:{redirectTo:MOBILE_OAUTH_REDIRECT,skipBrowserRedirect:true}});
        if(error)throw error;
        if(!data.url)throw new Error('OAuth provider did not return a sign-in URL.');
        await Browser.open({url:data.url,presentationStyle:'popover'});
      }else{
        const redirectTo=`${window.location.origin}${BASE_PATH}/`;
        const {error}=await supabase.auth.signInWithOAuth({provider,options:{redirectTo}});
        if(error)throw error;
      }
    }catch(err){setError(err instanceof Error?err.message:'OAuth sign-in failed.');setBusy(false);}
  }

  async function submit(e:FormEvent){
    e.preventDefault();setError('');setMessage('');
    if(!supabase){setError('Cloud authentication is not configured on this deployment.');return;}
    if(tab==='signup'&&password!==confirmPassword){setError('Passwords do not match.');return;}
    setBusy(true);
    try{
      if(tab==='signup'){
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:displayName||'Creator'}}});
        if(error)throw error;
        if(!data.session){
          setError('Redbound is configured for password accounts only, but Supabase is still requiring email confirmation. Turn off Confirm email in Supabase Auth so new accounts sign in immediately without codes or magic links.');
          return;
        }
        setMessage('Account created and signed in.');
      }else{
        const {error}=await supabase.auth.signInWithPassword({email,password});
        if(error)throw error;
      }
    }catch(err){setError(err instanceof Error?err.message:'Authentication failed.')}
    finally{setBusy(false);}
  }

  return <main className="gate ascension-gate"><Petals/><AngelSky/><section className="gate-poster" aria-label="Redbound Ascension poster"><AscensionMark/><div className="poster-copy"><p className="eyebrow">ANGELS FALL · STORIES RISE</p><h1>REDBOUND</h1><p>FROM CHAOS, CREATION.</p></div></section><section className="gate-card">
    <AscensionMark compact/><p className="eyebrow">ACCOUNT PORTAL</p><h1>REDBOUND</h1><p className="gate-copy">Use Google or GitHub OAuth, or create a Redbound account with your email and password. No one-time-code or magic-link sign-in is used.</p>
    <div className="auth-tabs"><button type="button" onClick={()=>setTab('signin')} className={tab==='signin'?'active':''}>Sign In</button><button type="button" onClick={()=>setTab('signup')} className={tab==='signup'?'active':''}>Create Account</button></div>
    <div className="oauth-grid">
      <button type="button" className="oauth-btn google" disabled={busy} onClick={()=>void oauth('google')}><span>G</span>{tab==='signup'?'Sign up':'Continue'} with Google</button>
      <button type="button" className="oauth-btn github" disabled={busy} onClick={()=>void oauth('github')}><span>⌘</span>{tab==='signup'?'Sign up':'Continue'} with GitHub</button>
    </div>
    <div className="or"><span/>or use email + password<span/></div>
    <form className="auth-form" onSubmit={submit}>
      {tab==='signup'&&<label>Display name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} autoComplete="name" /></label>}
      <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" /></label>
      <label>{tab==='signup'?'Create password':'Password'}<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={tab==='signup'?'new-password':'current-password'} /></label>
      {tab==='signup'&&<label>Confirm password<input type="password" required minLength={8} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" /></label>}
      {error&&<p className="form-error">{error}</p>}{message&&<p className="form-ok">{message}</p>}
      <button className="primary wide" disabled={busy}>{busy?'Working…':tab==='signup'?'Create Account':'Sign In'}</button>
    </form>
    <p className="auth-policy">Password accounts use email + password only. OAuth uses the selected provider. Redbound does not offer email OTP or magic-link login.</p>
    {allowGuest&&<><div className="or"><span/>or<span/></div><button className="ghost wide" type="button" onClick={onGuest}>Continue as Guest</button></>}
    <p className="gate-foot">Sign into the same account on web and Android to keep projects and AI memory synchronized.</p>
  </section></main>
}

export default function RedboundApp(){
  const [booted,setBooted]=useState(false); const [mode,setMode]=useState<AuthMode|null>(null); const [user,setUser]=useState<User|null>(null);
  const [guest,setGuest]=useState<GuestState|null>(null); const [projects,setProjects]=useState<Project[]>([]); const [sections,setSections]=useState<Section[]>([]); const [notes,setNotes]=useState<Note[]>([]); const [profile,setProfile]=useState<Profile|null>(null); const [activeProjectId,setActiveProjectId]=useState(''); const [activeSectionId,setActiveSectionId]=useState('');
  const [cloudBusy,setCloudBusy]=useState(false); const [toast,setToast]=useState(''); const [modal,setModal]=useState<'note'|'section'|'profile'|'collab'|null>(null); const [accessDenied,setAccessDenied]=useState(false);
  const [newTitle,setNewTitle]=useState(''); const [newBody,setNewBody]=useState(''); const [sectionTitle,setSectionTitle]=useState(''); const [inviteEmail,setInviteEmail]=useState(''); const [inviteRole,setInviteRole]=useState<'editor'|'viewer'>('editor'); const [inviteLink,setInviteLink]=useState('');
  const [messages,setMessages]=useState<MyriaMessage[]>([{id:'welcome',role:'assistant',content:MYRIA_WELCOME,createdAt:Date.now()}]);
  const [chat,setChat]=useState(''); const [myriaStatus,setMyriaStatus]=useState<MyriaStatus>('idle'); const [muted,setMuted]=useState(false); const [goals,setGoals]=useState<MyriaGoal[]>([]); const [focusMode,setFocusMode]=useState(false);
  const [voiceEnabled,setVoiceEnabled]=useState(false); const [voiceHealth,setVoiceHealth]=useState<VoiceHealth>('off');
  const [liveCallStatus,setLiveCallStatus]=useState<LiveCallStatus>('idle'); const [liveMicMuted,setLiveMicMuted]=useState(false); const [liveConversationId,setLiveConversationId]=useState('');
  const [profileName,setProfileName]=useState(''); const [profileBio,setProfileBio]=useState(''); const [profileAvatar,setProfileAvatar]=useState('');
  const saveTimers=useRef<Record<string,ReturnType<typeof setTimeout>>>({}); const audioRef=useRef<HTMLAudioElement|null>(null); const voiceAbort=useRef<AbortController|null>(null); const speechQueue=useRef<string[]>([]); const speakingRef=useRef(false);
  const audioContextRef=useRef<AudioContext|null>(null); const activeSourceRef=useRef<AudioBufferSourceNode|null>(null); const liveConversationRef=useRef<LiveConversationLike|null>(null);

  const activeProject=projects.find(p=>p.id===activeProjectId); const projectSections=useMemo(()=>sections.filter(s=>s.project_id===activeProjectId).sort((a,b)=>a.position-b.position),[sections,activeProjectId]);
  const activeSection=projectSections.find(s=>s.id===activeSectionId)??projectSections[0]; const sectionNotes=useMemo(()=>notes.filter(n=>n.project_id===activeProjectId&&n.section_id===activeSection?.id).sort((a,b)=>a.position-b.position),[notes,activeProjectId,activeSection?.id]);
  const role=(activeProject?.role??'viewer') as Role; const editable=mode==='guest'||canEdit(role);

  const notify=useCallback((m:string)=>{setToast(m);setTimeout(()=>setToast(''),2800)},[]);

  const refreshProjectContent=useCallback(async(id:string)=>{
    if(!supabase||!id)return;
    const [{data:ss,error:sErr},{data:nn,error:nErr}]=await Promise.all([
      supabase.from('sections').select('*').eq('project_id',id).order('position'),
      supabase.from('notes').select('*').eq('project_id',id).order('position')
    ]);
    if(sErr||nErr){notify((sErr??nErr)?.message??'Project sync failed.');return;}
    const nextSections=(ss??[]) as Section[];
    setSections(nextSections);setNotes((nn??[]) as Note[]);
    setActiveSectionId(current=>nextSections.some(section=>section.id===current)?current:(nextSections[0]?.id??''));
  },[notify]);

  const loadProjectMemory=useCallback(async(id:string)=>{
    if(!supabase||!id)return;
    const [{data:gg,error:gErr},{data:tt,error:tErr},{data:cc,error:cErr}]=await Promise.all([
      supabase.from('myria_goals').select('*').eq('project_id',id).order('created_at',{ascending:false}),
      supabase.from('myria_tasks').select('*').eq('project_id',id).order('created_at',{ascending:true}),
      supabase.from('myria_conversations').select('id,role,content,created_at').eq('project_id',id).order('created_at',{ascending:true}).limit(60)
    ]);
    if(gErr||tErr||cErr){notify((gErr??tErr??cErr)?.message??'Myria memory sync failed.');return;}
    const goalRows=(gg??[]) as Array<{id:string;title?:string|null;goal:string;description:string;reason:string;priority:number;status:string}>;
    const taskRows=(tt??[]) as Array<{id:string;goal_id:string;description:string;status:string;risk_level:'low'|'medium'|'high';attempts:number;max_attempts:number;verification:string;reflection:string}>;
    setGoals(goalRows.map(g=>({id:g.id,title:g.title||g.goal,description:g.description,reason:g.reason,priority:g.priority,status:g.status,tasks:taskRows.filter(t=>t.goal_id===g.id).map(t=>({id:t.id,description:t.description,status:t.status,riskLevel:t.risk_level,attempts:t.attempts,maxAttempts:t.max_attempts,verification:t.verification,reflection:t.reflection}))})));
    const conversationRows=(cc??[]) as Array<{id:string;role:'user'|'assistant';content:string;created_at:string}>;
    setMessages(conversationRows.length?conversationRows.map(row=>({id:row.id,role:row.role,content:row.content,createdAt:Date.parse(row.created_at)})):[{id:'welcome',role:'assistant',content:MYRIA_WELCOME,createdAt:Date.now()}]);
  },[notify]);

  const loadCloud=useCallback(async(currentUser:User)=>{if(!supabase)return;setCloudBusy(true);
    const [{data:pRows,error:pErr},{data:prof},{data:bootstrap}]=await Promise.all([supabase.from('projects').select('*').order('updated_at',{ascending:false}),supabase.from('profiles').select('*').eq('user_id',currentUser.id).maybeSingle(),supabase.rpc('can_bootstrap_reforge')]);
    if(pErr){notify(pErr.message);setCloudBusy(false);return;}
    const ps=(pRows??[]) as Project[];
    const memberships=ps.length?await supabase.from('project_members').select('project_id,role').in('project_id',ps.map(p=>p.id)):({data:[]} as const);
    const membershipRows=(memberships.data??[]) as Array<{project_id:string;role:Role}>;
    const roleMap=new Map(membershipRows.map(m=>[m.project_id,m.role])); ps.forEach(p=>p.role=(roleMap.get(p.id)??(p.owner_id===currentUser.id?'owner':'viewer')) as Role);
    const cloudProfile=prof as Profile|null; const allowed=ps.length>0||bootstrap===true; setAccessDenied(!allowed);
    setProjects(ps);setProfile(cloudProfile);setProfileName(cloudProfile?.display_name??'Creator');setProfileBio(cloudProfile?.bio??'');setProfileAvatar(cloudProfile?.avatar_url??'');
    if(!allowed){setActiveProjectId('');setSections([]);setNotes([]);setGoals([]);setMessages([{id:'welcome',role:'assistant',content:MYRIA_WELCOME,createdAt:Date.now()}]);setCloudBusy(false);return;}
    const requested=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('project'):null;
    const target=requested&&ps.some(p=>p.id===requested)?requested:(activeProjectId&&ps.some(p=>p.id===activeProjectId)?activeProjectId:ps[0]?.id??'');setActiveProjectId(target);
    if(target)await Promise.all([refreshProjectContent(target),loadProjectMemory(target)]);
    else{setSections([]);setNotes([]);setGoals([]);setMessages([{id:'welcome',role:'assistant',content:MYRIA_WELCOME,createdAt:Date.now()}]);}
    setCloudBusy(false);
  },[activeProjectId,loadProjectMemory,notify,refreshProjectContent]);

  const claimPendingInvite=useCallback(async()=>{if(!supabase||typeof window==='undefined')return;const token=window.localStorage.getItem('redbound-pending-invite');if(!token)return;const {data,error}=await supabase.rpc('accept_collaboration_invite',{p_token:token});if(error)return;window.localStorage.removeItem('redbound-pending-invite');if(data)window.history.replaceState(null,'',`${BASE_PATH}/?project=${encodeURIComponent(String(data))}`);notify('Private invite accepted automatically.');},[notify]);
  useEffect(()=>{if(!supabase){setBooted(true);return;}void (async()=>{const {data}=await supabase!.auth.getSession();setUser(data.session?.user??null);if(data.session){setMode('account');await claimPendingInvite();await loadCloud(data.session.user);}setBooted(true)})();const {data}=supabase.auth.onAuthStateChange((_event,s)=>{setUser(s?.user??null);if(s){setMode('account');queueMicrotask(()=>void (async()=>{await claimPendingInvite();await loadCloud(s.user)})());}else{setMode(null);setAccessDenied(false);}});return()=>data.subscription.unsubscribe();},[claimPendingInvite,loadCloud]);
  useEffect(()=>{if(mode==='guest'&&guest)saveGuestState(guest)},[guest,mode]);
  useEffect(()=>{if(mode==='guest'&&guest){setProjects(guest.projects);setSections(guest.sections);setNotes(guest.notes);setActiveProjectId(guest.activeProjectId);setProfile({user_id:'guest',display_name:guest.profile.display_name,bio:guest.profile.bio});setGoals(guest.goals)}},[guest,mode]);
  useEffect(()=>{if(projectSections.length&&!projectSections.some(s=>s.id===activeSectionId))setActiveSectionId(projectSections[0].id)},[projectSections,activeSectionId]);
  useEffect(()=>{if('serviceWorker'in navigator)navigator.serviceWorker.register(`${BASE_PATH}/sw.js`).catch(()=>undefined)},[]);
  useEffect(()=>()=>{void liveConversationRef.current?.endSession();void audioContextRef.current?.close();},[]);
  useEffect(()=>{
    const client=supabase;
    if(mode!=='account'||!client||!activeProjectId)return;
    const channel=client.channel(`redbound-project-${activeProjectId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'notes',filter:`project_id=eq.${activeProjectId}`},()=>{void refreshProjectContent(activeProjectId)})
      .on('postgres_changes',{event:'*',schema:'public',table:'sections',filter:`project_id=eq.${activeProjectId}`},()=>{void refreshProjectContent(activeProjectId)})
      .subscribe();
    return()=>{void client.removeChannel(channel)};
  },[activeProjectId,mode,refreshProjectContent]);

  function enterGuest(){const state=loadGuestState();setGuest(state);setMode('guest');sessionStorage.setItem('reforge-guest','1');}
  async function switchProject(id:string){setActiveProjectId(id);if(mode==='guest'&&guest){setGuest({...guest,activeProjectId:id});return;}if(supabase){setCloudBusy(true);await Promise.all([refreshProjectContent(id),loadProjectMemory(id)]);setCloudBusy(false)}}
  async function createProject(){const title=prompt('Project title')?.trim();if(!title)return;if(mode==='guest'&&guest){const next=newGuestProject(guest,title);setGuest(next);notify('Project created locally.');return;}if(supabase&&user){const {data,error}=await supabase.from('projects').insert({owner_id:user.id,title,description:''}).select().single();if(error){notify(error.message);return;}await loadCloud(user);if(data)await switchProject(data.id);notify('Cloud project created.')}}
  async function addSection(e:FormEvent){e.preventDefault();const title=sectionTitle.trim();if(!title||!activeProjectId)return;const section:Section={id:uid(),project_id:activeProjectId,title,slug:slugify(title)||`section-${Date.now()}`,position:projectSections.length,is_system:false,created_by:user?.id};if(mode==='guest'&&guest){setGuest({...guest,sections:[...guest.sections,section]});setActiveSectionId(section.id);}else if(supabase&&user){const {data,error}=await supabase.from('sections').insert({...section,id:undefined,created_by:user.id}).select().single();if(error){notify(error.message);return;}setSections(v=>[...v,data as Section]);setActiveSectionId(data.id);}setSectionTitle('');setModal(null);notify('Section added.');}
  async function addNote(e:FormEvent){e.preventDefault();if(!activeProjectId||!newBody.trim())return;const target=inferSection(newBody,projectSections)??activeSection?.id;const targetSection=projectSections.find(s=>s.id===target);const note:Note={id:uid(),project_id:activeProjectId,author_id:user?.id,section_id:target,title:newTitle.trim()||'Untitled fragment',body:newBody.trim(),category:targetSection?.title??'Brainstorming',position:notes.filter(n=>n.section_id===target).length};if(mode==='guest'&&guest){setGuest(upsertGuestNote(guest,note));}else if(supabase&&user){const {data,error}=await supabase.from('notes').insert({...note,id:undefined,author_id:user.id}).select().single();if(error){notify(error.message);return;}setNotes(v=>[...v,data as Note]);}setNewTitle('');setNewBody('');setModal(null);if(target)setActiveSectionId(target);notify(`Saved to ${targetSection?.title??'the project'}.`);}
  function updateNoteDraft(id:string,patch:Partial<Note>){setNotes(current=>current.map(n=>n.id===id?{...n,...patch}:n));if(mode==='guest'&&guest){const old=guest.notes.find(n=>n.id===id);if(old)setGuest(upsertGuestNote(guest,{...old,...patch}));return;}if(!supabase)return;clearTimeout(saveTimers.current[id]);saveTimers.current[id]=setTimeout(async()=>{const {error}=await supabase!.from('notes').update(patch).eq('id',id);if(error)notify(`Autosave failed: ${error.message}`);},650)}
  async function deleteNote(id:string){if(!confirm('Delete this note?'))return;if(mode==='guest'&&guest){setGuest({...guest,notes:guest.notes.filter(n=>n.id!==id)});}else if(supabase){const {error}=await supabase.from('notes').delete().eq('id',id);if(error){notify(error.message);return;}setNotes(v=>v.filter(n=>n.id!==id));}}
  async function dropNote(noteId:string,targetSectionId:string){if(!editable)return;const section=projectSections.find(s=>s.id===targetSectionId);updateNoteDraft(noteId,{section_id:targetSectionId,category:section?.title??'Custom'});setActiveSectionId(targetSectionId);notify(`Moved to ${section?.title}.`)}

  async function saveProfile(e:FormEvent){e.preventDefault();if(mode==='guest'&&guest){setGuest({...guest,profile:{display_name:profileName,bio:profileBio}});setProfile(p=>p?{...p,display_name:profileName,bio:profileBio}:p);}else if(supabase&&user){const {error}=await supabase.from('profiles').update({display_name:profileName,bio:profileBio,avatar_url:profileAvatar||null,updated_at:new Date().toISOString()}).eq('user_id',user.id);if(error){notify(error.message);return;}setProfile(p=>p?{...p,display_name:profileName,bio:profileBio,avatar_url:profileAvatar}:p);}setModal(null);notify('Profile saved.');}
  async function invite(e:FormEvent){e.preventDefault();if(!supabase||!user||!activeProjectId)return;const email=inviteEmail.trim().toLowerCase()||null;const {data,error}=await supabase.from('collaboration_invites').insert({project_id:activeProjectId,created_by:user.id,email,role:inviteRole}).select('token').single();if(error){notify(error.message);return;}const link=`${window.location.origin}${BASE_PATH}/invite/?token=${encodeURIComponent(data.token)}`;setInviteLink(link);setInviteEmail('');try{await navigator.clipboard.writeText(link);notify('Private invite link created and copied.');}catch{notify('Private invite link created. Copy it from this panel.')}}

  const projectContext=()=>({project:activeProject?{title:activeProject.title,description:activeProject.description}:null,sections:projectSections.map(s=>s.title),notes:notes.filter(n=>n.project_id===activeProjectId).slice(0,80).map(n=>({title:n.title,body:n.body,category:n.category})),goals:goals.slice(0,8).map(g=>({title:g.title,status:g.status}))});

  async function saveVoiceNote(input:{title:string;content:string;section_name:string}){
    const content=input.content.trim();
    if(!content)return 'Nothing was saved because the note content was empty.';
    if(mode!=='account'||!supabase||!user||!activeProjectId)return 'Sign in to a cloud project before asking me to save notes.';
    if(!editable)return 'This project is read-only, so I cannot save a note here.';
    const requested=input.section_name.trim().toLowerCase();
    const named=projectSections.find(section=>section.title.toLowerCase()===requested);
    const targetId=named?.id??inferSection(content,projectSections)??activeSection?.id;
    const targetSection=projectSections.find(section=>section.id===targetId);
    if(!targetId||!targetSection)return 'I could not find a project section to save this note into.';
    const draft={project_id:activeProjectId,author_id:user.id,section_id:targetId,title:input.title.trim()||'Myria brainstorm note',body:content,category:targetSection.title,position:notes.filter(note=>note.section_id===targetId).length};
    const {data,error}=await supabase.from('notes').insert(draft).select().single();
    if(error)return `I could not save the note: ${error.message}`;
    setNotes(current=>[...current,data as Note]);
    notify(`Myria saved a note to ${targetSection.title}.`);
    return `Saved "${data.title}" to ${targetSection.title}.`;
  }
  async function persistGoal(suggestion:{title:string;description:string;reason:string;priority:number;tasks:{description:string;riskLevel:'low'|'medium'|'high'}[]}){
    const goal:MyriaGoal={id:uid(),title:suggestion.title,description:suggestion.description,reason:suggestion.reason,priority:suggestion.priority,status:'planned',tasks:suggestion.tasks.map(t=>({id:uid(),description:t.description,status:'planned',riskLevel:t.riskLevel,attempts:0,maxAttempts:3}))};
    setGoals(v=>[goal,...v]);
    if(mode==='guest'&&guest){setGuest(addGuestGoal(guest,goal));return;}
    if(supabase&&user){
      const {data:g,error}=await supabase.from('myria_goals').insert({user_id:user.id,project_id:activeProjectId,goal:goal.title,title:goal.title,description:goal.description,reason:goal.reason,priority:goal.priority,status:'planned'}).select().single();
      if(error)return;
      const cloudTasks:MyriaTask[]=[];
      for(const task of goal.tasks){
        const {data:t}=await supabase.from('myria_tasks').insert({goal_id:g.id,project_id:activeProjectId,user_id:user.id,description:task.description,risk_level:task.riskLevel,status:'planned',attempts:0,max_attempts:3}).select().single();
        if(t)cloudTasks.push({id:t.id,description:t.description,status:t.status,riskLevel:t.risk_level,attempts:t.attempts,maxAttempts:t.max_attempts,verification:t.verification,reflection:t.reflection});
      }
      setGoals(current=>current.map(item=>item.id===goal.id?{...goal,id:g.id,tasks:cloudTasks}:item));
    }
  }

  function updateTaskState(goalId:string,taskId:string,patch:Partial<MyriaTask>){
    setGoals(current=>current.map(goal=>goal.id===goalId?{...goal,tasks:goal.tasks.map(task=>task.id===taskId?{...task,...patch}:task)}:goal));
    if(mode==='guest')setGuest(current=>current?{...current,goals:current.goals.map(goal=>goal.id===goalId?{...goal,tasks:goal.tasks.map(task=>task.id===taskId?{...task,...patch}:task)}:goal)}:current);
  }

  async function logTaskActivity(goalId:string,taskId:string,status:string,reason:string,action:string,result:string,verification:string,reflection:string,retryCount:number){
    if(mode!=='account'||!supabase||!user||!activeProjectId)return;
    await supabase.from('myria_activity').insert({project_id:activeProjectId,user_id:user.id,goal_id:goalId,task_id:taskId,status,reason,action,resources:['project_context'],result,verification,reflection,retry_count:retryCount});
  }

  async function runMyriaTask(goalId:string,task:MyriaTask){
    if(task.riskLevel!=='low'){
      updateTaskState(goalId,task.id,{status:'waiting_approval'});
      if(mode==='account'&&supabase&&user){
        await supabase.from('myria_tasks').update({status:'waiting_approval'}).eq('id',task.id);
        await supabase.from('myria_approvals').upsert({project_id:activeProjectId,task_id:task.id,requested_by:user.id,risk_level:task.riskLevel==='high'?'high':'medium',status:'pending',reason:`Myria requested approval before executing: ${task.description}`},{onConflict:'task_id'});
      }
      notify(`${task.riskLevel==='high'?'High':'Medium'}-risk task is waiting for owner approval.`);
      return;
    }
    let taskText=task.description;
    let latest: {actualResult:string;verification:{passed:boolean;evidence:string[]};reflection:string;revisedTask:string|null}|null=null;
    const maxAttempts=Math.min(3,Math.max(1,task.maxAttempts||3));
    for(let attempt=Math.max(1,task.attempts+1);attempt<=maxAttempts;attempt++){
      updateTaskState(goalId,task.id,{status:'working',attempts:attempt});
      if(mode==='account'&&supabase)await supabase.from('myria_tasks').update({status:'working',attempts:attempt}).eq('id',task.id);
      try{
        if(!supabase)throw new Error('Private project authentication is required.');const {data:{session}}=await supabase.auth.getSession();const auth=session?.access_token;if(!auth||!activeProjectId)throw new Error('Private project authentication is required.');const res=await fetch(AI_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${auth}`,'apikey':SUPABASE_PUBLIC_KEY},body:JSON.stringify({action:'task',projectId:activeProjectId,task:taskText,context:projectContext(),attempt})});
        const data=await res.json();if(!res.ok)throw new Error(data.error||'Task execution failed.');latest=data;
        const evidence=data.verification.evidence.join(' · ');
        await logTaskActivity(goalId,task.id,data.verification.passed?'complete':'retrying',task.description,taskText,data.actualResult,evidence,data.reflection,attempt-1);
        if(data.verification.passed){
          const patch={status:'complete',attempts:attempt,verification:evidence,reflection:data.reflection};updateTaskState(goalId,task.id,patch);
          if(mode==='account'&&supabase)await supabase.from('myria_tasks').update({status:'complete',attempts:attempt,actual_result:data.actualResult,verification:evidence,reflection:data.reflection,completed_at:new Date().toISOString()}).eq('id',task.id);
          notify('Myria verified the task and marked it complete.');return;
        }
        taskText=data.revisedTask||taskText;
      }catch(err){
        const message=err instanceof Error?err.message:'Task execution failed.';latest={actualResult:message,verification:{passed:false,evidence:[]},reflection:'The task service could not complete this attempt.',revisedTask:null};
        await logTaskActivity(goalId,task.id,'retrying',task.description,taskText,message,'',latest.reflection,attempt-1);
      }
    }
    const reflection=latest?.reflection||'Verification did not pass within the bounded retry limit.';
    updateTaskState(goalId,task.id,{status:'needs_human_review',attempts:maxAttempts,verification:latest?.verification.evidence.join(' · ')||'',reflection});
    if(mode==='account'&&supabase)await supabase.from('myria_tasks').update({status:'needs_human_review',attempts:maxAttempts,verification:latest?.verification.evidence.join(' · ')||'',reflection}).eq('id',task.id);
    notify('Myria reached the retry limit and needs human review.');
  }

  async function persistConversation(role:'user'|'assistant',content:string){
    if(mode!=='account'||!supabase||!user||!activeProjectId)return;
    const {error}=await supabase.from('myria_conversations').insert({project_id:activeProjectId,user_id:user.id,role,content});
    if(error)console.warn('Myria conversation persistence failed:',error.message);
  }
  function appendLiveTranscript(role:'user'|'assistant',content:string){
    const text=content.trim();if(!text)return;
    setMessages(current=>{
      const last=current[current.length-1];
      if(last?.role===role&&last.content===text)return current;
      return [...current,{id:uid(),role,content:text,createdAt:Date.now()}];
    });
    void persistConversation(role,text);
  }

  async function sendMyria(e?:FormEvent,override?:string){e?.preventDefault();const text=(override??chat).trim();if(!text)return;stopSpeech();const userMsg:MyriaMessage={id:uid(),role:'user',content:text,createdAt:Date.now()};const next=[...messages,userMsg];setMessages(next);setChat('');setMyriaStatus('thinking');void persistConversation('user',text);
    try{if(!supabase)throw new Error('Private project authentication is required.');const {data:{session}}=await supabase.auth.getSession();const auth=session?.access_token;if(!auth||!activeProjectId)throw new Error('Private project authentication is required.');const res=await fetch(AI_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${auth}`,'apikey':SUPABASE_PUBLIC_KEY},body:JSON.stringify({action:'myria',projectId:activeProjectId,message:text,context:projectContext(),history:next.slice(-20).map(m=>({role:m.role,content:m.content}))})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Myria is unavailable.');const a:MyriaMessage={id:uid(),role:'assistant',content:data.message,createdAt:Date.now()};setMessages(v=>[...v,a]);void persistConversation('assistant',data.message);if(data.suggestion)await persistGoal(data.suggestion);setMyriaStatus('idle');if(voiceEnabled&&!muted)queueSpeech(data.message);}catch(err){setMyriaStatus('error');const m=err instanceof Error?err.message:'Myria is unavailable.';const fallback=`I can't reach my reasoning service right now. ${m}`;setMessages(v=>[...v,{id:uid(),role:'assistant',content:fallback,createdAt:Date.now()}]);void persistConversation('assistant',fallback);}}
  async function ensureAudioContext(){
    if(typeof window==='undefined')return null;
    const w=window as Window&{webkitAudioContext?:typeof AudioContext};
    const Ctor=window.AudioContext??w.webkitAudioContext;
    if(!Ctor)return null;
    let ctx=audioContextRef.current;
    if(!ctx){ctx=new Ctor();audioContextRef.current=ctx;}
    if(ctx.state==='suspended')await ctx.resume();
    return ctx;
  }

  async function unlockVoiceOutput(){
    const ctx=await ensureAudioContext();
    if(!ctx)return;
    const buffer=ctx.createBuffer(1,1,ctx.sampleRate);
    const source=ctx.createBufferSource();
    source.buffer=buffer;source.connect(ctx.destination);source.start(0);
  }

  function stopSpeech(){
    speechQueue.current=[];
    voiceAbort.current?.abort();voiceAbort.current=null;
    try{activeSourceRef.current?.stop();}catch{}
    activeSourceRef.current=null;
    if(audioRef.current){audioRef.current.pause();audioRef.current.src='';audioRef.current=null;}
    if(typeof window!=='undefined'&&'speechSynthesis'in window)window.speechSynthesis.cancel();
    speakingRef.current=false;
    if(myriaStatus==='talking')setMyriaStatus('idle');
  }

  async function fetchVoiceBlob(action:'voice'|'voice-test',text?:string,signal?:AbortSignal){
    if(!supabase)throw new Error('Cloud voice is not configured.');
    const {data:{session}}=await supabase.auth.getSession();
    const auth=session?.access_token;
    if(!auth||!activeProjectId)throw new Error('Sign in to a cloud project to use Myria voice.');
    const res=await fetch(AI_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${auth}`,'apikey':SUPABASE_PUBLIC_KEY},body:JSON.stringify({action,text,projectId:activeProjectId}),signal});
    if(!res.ok){
      let detail='';
      try{const data=await res.clone().json() as {error?:string};detail=data.error??'';}catch{}
      throw new Error(detail||`Voice request failed (${res.status}).`);
    }
    const blob=await res.blob();
    if(!blob.size)throw new Error('Voice service returned empty audio.');
    return blob;
  }

  async function playVoiceBlob(blob:Blob){
    const ctx=await ensureAudioContext();
    if(ctx){
      const bytes=await blob.arrayBuffer();
      const decoded=await ctx.decodeAudioData(bytes.slice(0));
      await new Promise<void>((resolve)=>{
        const source=ctx.createBufferSource();
        source.buffer=decoded;source.connect(ctx.destination);activeSourceRef.current=source;
        source.onended=()=>{if(activeSourceRef.current===source)activeSourceRef.current=null;resolve();};
        source.start(0);
      });
      return;
    }
    const url=URL.createObjectURL(blob);
    try{
      const audio=new Audio(url);audio.preload='auto';audioRef.current=audio;
      await audio.play();
      await new Promise<void>((resolve,reject)=>{audio.onended=()=>resolve();audio.onerror=()=>reject(new Error('Audio playback failed.'));});
    }finally{URL.revokeObjectURL(url);audioRef.current=null;}
  }

  async function speakWithDeviceVoice(text:string){
    if(typeof window==='undefined'||!('speechSynthesis'in window))throw new Error('This device does not expose a fallback speech engine.');
    await new Promise<void>((resolve,reject)=>{
      window.speechSynthesis.cancel();
      const utterance=new SpeechSynthesisUtterance(text);
      utterance.lang='en-GB';utterance.rate=.96;utterance.pitch=1;utterance.volume=1;
      const voices=window.speechSynthesis.getVoices();
      utterance.voice=voices.find(v=>v.lang.toLowerCase().startsWith('en-gb'))??voices.find(v=>v.lang.toLowerCase().startsWith('en'))??null;
      utterance.onend=()=>resolve();utterance.onerror=event=>reject(new Error(event.error||'Device speech failed.'));
      window.speechSynthesis.speak(utterance);
    });
  }

  async function enableMyriaVoice(){
    if(voiceHealth==='testing')return;
    setVoiceHealth('testing');setMuted(false);
    try{
      await unlockVoiceOutput();
      const blob=await fetchVoiceBlob('voice-test');
      setMyriaStatus('talking');
      await playVoiceBlob(blob);
      setVoiceEnabled(true);setVoiceHealth('ready');setMyriaStatus('idle');
      notify('Myria voice test passed. Spoken replies are enabled.');
    }catch(err){
      const reason=err instanceof Error?err.message:'Voice test failed.';
      try{
        await speakWithDeviceVoice("Myria's cloud voice could not start, so device speech is enabled as a fallback.");
        setVoiceEnabled(true);setVoiceHealth('fallback');setMyriaStatus('idle');
        notify(`Cloud voice fallback enabled: ${reason}`);
      }catch{
        setVoiceEnabled(false);setVoiceHealth('error');setMyriaStatus('error');
        notify(reason);
      }
    }
  }

  function queueSpeech(text:string){
    if(!voiceEnabled||muted)return;
    speechQueue.current.push(text);void processSpeechQueue();
  }

  async function speakOnDemand(text:string){
    if(!text.trim())return;
    await unlockVoiceOutput().catch(()=>undefined);
    if(!voiceEnabled){setVoiceEnabled(true);setMuted(false);}
    speechQueue.current.push(text);void processSpeechQueue();
  }

  async function processSpeechQueue(){
    if(speakingRef.current||muted||!voiceEnabled||!speechQueue.current.length)return;
    speakingRef.current=true;setMyriaStatus('talking');
    const text=speechQueue.current.shift()!;
    const controller=new AbortController();voiceAbort.current=controller;
    try{
      const blob=await fetchVoiceBlob('voice',text,controller.signal);
      await playVoiceBlob(blob);
      setVoiceHealth('ready');
    }catch(err){
      if(controller.signal.aborted)return;
      const reason=err instanceof Error?err.message:'Voice playback failed.';
      try{
        await speakWithDeviceVoice(text);
        setVoiceHealth('fallback');
        notify(`Myria used device speech because cloud voice failed: ${reason}`);
      }catch(fallbackErr){
        setVoiceHealth('error');
        notify(fallbackErr instanceof Error?fallbackErr.message:'Myria could not speak on this device.');
      }
    }finally{
      speakingRef.current=false;voiceAbort.current=null;
      if(speechQueue.current.length&&!muted&&voiceEnabled)void processSpeechQueue();else setMyriaStatus('idle');
    }
  }

  async function startLiveCall(){
    if(liveCallStatus==='connecting'||liveCallStatus==='connected')return;
    if(mode!=='account'||!supabase||!user||!activeProjectId){notify('Sign in to a cloud project to start a live Myria call.');return;}
    setLiveCallStatus('connecting');setLiveMicMuted(false);stopSpeech();setMyriaStatus('observing');
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('This device does not expose microphone access.');
      const permission=await navigator.mediaDevices.getUserMedia({audio:true});
      permission.getTracks().forEach(track=>track.stop());
      const {data:{session}}=await supabase.auth.getSession();
      const auth=session?.access_token;if(!auth)throw new Error('Your session expired. Sign in again.');
      const res=await fetch(AI_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${auth}`,'apikey':SUPABASE_PUBLIC_KEY},body:JSON.stringify({action:'live-session',projectId:activeProjectId})});
      const data=await res.json() as {signedUrl?:string;conversationId?:string|null;error?:string};
      if(!res.ok||!data.signedUrl)throw new Error(data.error||'Live voice session could not start.');

      const {Conversation}=await import('@elevenlabs/client');
      const startSession=Conversation.startSession.bind(Conversation) as unknown as (options:Record<string,unknown>)=>Promise<unknown>;
      const conversation=await startSession({
        signedUrl:data.signedUrl,
        connectionType:'websocket',
        userId:user.id,
        onConnect:()=>{setLiveCallStatus('connected');setMyriaStatus('observing');},
        onDisconnect:()=>{liveConversationRef.current=null;setLiveCallStatus('idle');setLiveMicMuted(false);setMyriaStatus('idle');},
        onError:(error:unknown)=>{setLiveCallStatus('error');setMyriaStatus('error');notify(`Live Myria error: ${error instanceof Error?error.message:String(error)}`);},
        onMessage:(event:unknown)=>{const text=liveEventText(event);if(text){appendLiveTranscript('assistant',text);setMyriaStatus('talking');}},
        onUserTranscript:(event:unknown)=>{const text=liveEventText(event);if(text){appendLiveTranscript('user',text);setMyriaStatus('thinking');}},
        onModeChange:(event:unknown)=>{
          const modeValue=event&&typeof event==='object'&&'mode'in event?String((event as {mode?:unknown}).mode):'';
          if(modeValue==='speaking')setMyriaStatus('talking');
          else if(modeValue==='listening')setMyriaStatus('observing');
        },
        clientTools:{
          create_note:async(input:unknown)=>{
            const item=(input&&typeof input==='object'?input:{}) as {title?:unknown;content?:unknown;section_name?:unknown};
            return saveVoiceNote({
              title:typeof item.title==='string'?item.title:'',
              content:typeof item.content==='string'?item.content:'',
              section_name:typeof item.section_name==='string'?item.section_name:'',
            });
          },
        },
      });
      const live=conversation as LiveConversationLike;
      liveConversationRef.current=live;
      const context=JSON.stringify(projectContext()).slice(0,24000);
      live.sendContextualUpdate('Private Redbound project context for this conversation: '+context);
      setLiveConversationId(data.conversationId??'');setLiveCallStatus('connected');setMyriaStatus('observing');
      notify('Live Myria call connected. Start talking.');
    }catch(err){
      liveConversationRef.current=null;setLiveCallStatus('error');setMyriaStatus('error');
      notify(err instanceof Error?err.message:'Live Myria call failed to start.');
    }
  }
  async function endLiveCall(){
    const live=liveConversationRef.current;liveConversationRef.current=null;
    try{await live?.endSession();}catch{}
    setLiveCallStatus('idle');setLiveMicMuted(false);setLiveConversationId('');
  }

  async function toggleLiveMic(){
    const live=liveConversationRef.current;if(!live)return;
    const next=!liveMicMuted;
    try{await live.setMicMuted(next);setLiveMicMuted(next);}catch{notify('Could not change the live microphone state.');}
  }

  function toggleMute(){
    const next=!muted;setMuted(next);
    if(next)stopSpeech();
    else if(!voiceEnabled)void enableMyriaVoice();
  }

  if(!booted)return <div className="loading"><Petals/><div className="gate-mark">R</div><p>Heating the forge…</p></div>;
  if(!mode)return <AuthGate onGuest={enterGuest} allowGuest/>;
  if(mode==='account'&&accessDenied)return <main className="gate"><Petals/><section className="gate-card"><div className="gate-mark">R</div><p className="eyebrow">PRIVATE WORKSPACE</p><h1>INVITATION REQUIRED</h1><p className="gate-copy">This account is valid, but it has not been granted access to a Redbound project. Open a private invite link from a project owner or editor and Redbound will add you automatically without an approval request.</p><button className="ghost wide" onClick={async()=>{await supabase?.auth.signOut();setMode(null)}}>Sign out</button></section></main>;

  return <div className={`shell ${focusMode?'focus-mode':''}`}><Petals/><header className="topbar">
    <div className="brand"><AscensionMark compact/><div><strong>REDBOUND</strong><span>STORIES ARE MADE, THEN REMADE.</span></div></div>
    <div className="top-actions"><span className="sync">{mode==='account'?<><Cloud size={14}/> Cloud</>:<><CloudOff size={14}/> Guest</>}</span><button className="icon-btn" onClick={()=>setModal('collab')} title="Collaboration"><Users size={18}/></button><button className="profile-btn" onClick={()=>setModal('profile')}>{profile?.avatar_url?<img src={profile.avatar_url} alt=""/>:<CircleUserRound size={20}/>}<span>{profile?.display_name??'Creator'}</span><ChevronDown size={14}/></button></div>
  </header>

  <main className="main">
    <section className="project-rail glass"><div><span className="label">Active project</span><select value={activeProjectId} onChange={e=>switchProject(e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></div><button className="ghost" onClick={createProject}><Plus size={15}/> New Project</button><button className="ghost" onClick={()=>setModal('section')} disabled={!editable}><Plus size={15}/> Custom Section</button><div className="rail-spacer"/><span className="save-state"><Save size={14}/>{cloudBusy?'Syncing…':'Autosave on'}</span></section>

    <section className="hero glass"><p className="eyebrow">THE CRIMSON ARCHIVE · {mode==='guest'?'LOCAL':'CLOUD'}</p><h1>{activeProject?.title??'Your story begins here.'}</h1><p>{activeProject?.description||'Build novels, manga, comics, memoirs, poetry, nonfiction, scripts, lore books, or any manuscript with RPG-style progression, cloud memory, and a persistent creative partner.'}</p><div className="hero-rule"/></section>

    <nav className="section-nav glass" aria-label="Story sections">{projectSections.map(s=><button key={s.id} className={activeSection?.id===s.id?'active':''} onClick={()=>{setActiveSectionId(s.id);setFocusMode(true)}} onDragOver={e=>editable&&e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/reforge-note');if(id)void dropNote(id,s.id)}}>{s.title}<span>{notes.filter(n=>n.section_id===s.id).length}</span></button>)}</nav>

    <div className="workspace-grid">
      <section className="content-panel glass"><div className="panel-head"><div>{focusMode&&<button className="back-main" onClick={()=>setFocusMode(false)}><ArrowLeft size={15}/> Back to Main Menu</button>}<p className="eyebrow">CURRENT SECTION</p><h2>{activeSection?.title??'Workspace'}</h2><p>{editable?'Edit freely. Changes autosave as you type. Drag notes onto section tabs to reorganize.':'Viewer access — this project is read only.'}</p></div><button className="primary" disabled={!editable} onClick={()=>setModal('note')}><Plus size={16}/> Add Note</button></div>
        <div className="notes-grid">{sectionNotes.length?sectionNotes.map(note=><article key={note.id} className="note-card" draggable={editable} onDragStart={e=>{e.dataTransfer.setData('text/reforge-note',note.id);e.dataTransfer.effectAllowed='move'}}><div className="drag"><GripVertical size={16}/></div><input className="note-title" value={note.title} readOnly={!editable} onChange={e=>updateNoteDraft(note.id,{title:e.target.value})}/><textarea className="note-body" value={note.body} readOnly={!editable} onChange={e=>updateNoteDraft(note.id,{body:e.target.value})}/><div className="note-foot"><span>{note.category}</span>{editable&&<button onClick={()=>deleteNote(note.id)}>Delete</button>}</div></article>):<div className="empty"><BookOpen size={34}/><strong>No fragments here yet.</strong><span>Add a note. Redbound routes new notes by their content, not their title.</span></div>}</div>
      </section>

      <aside className="myria glass">
        <div className="myria-head">
          <div className={`myria-orb ${myriaStatus}`}><Bot className="myria-fallback" size={24}/><img className="myria-profile-image" src={`${BASE_PATH}/myria-profile.jpg`} alt="Myria" onError={e=>{e.currentTarget.style.display='none'}}/></div>
          <div><p className="eyebrow">BRAINSTORMING ASSISTANT</p><h2>MYRIA</h2><span className="status-line">{liveCallStatus==='connected'?'Live voice connected':liveCallStatus==='connecting'?'Connecting live voice…':myriaStatus==='thinking'?'Thinking…':myriaStatus==='talking'?'Speaking…':myriaStatus==='error'?'Service issue':'Ready to brainstorm'}</span></div>
          <div className="myria-controls"><button className="icon-btn" onClick={toggleMute} title={muted?'Enable spoken replies':'Mute spoken replies'}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button></div>
        </div>

        <div className="voice-console" aria-label="Myria voice controls">
          <div className="voice-console-head"><strong>Voice</strong><span className={`voice-health ${voiceHealth}`}>{voiceHealth==='ready'?'Wistoria ready':voiceHealth==='testing'?'Testing…':voiceHealth==='fallback'?'Device fallback':voiceHealth==='error'?'Voice error':voiceEnabled?'Enabled':'Not tested'}</span></div>
          <div className="voice-actions">
            <button type="button" className={`voice-action ${voiceHealth==='ready'?'ready':''}`} disabled={voiceHealth==='testing'||liveCallStatus==='connecting'} onClick={()=>void enableMyriaVoice()}>{voiceHealth==='testing'?'Testing Voice…':voiceHealth==='ready'?'Test Voice Again':'Enable + Test Voice'}</button>
            {liveCallStatus==='connected'
              ?<button type="button" className="voice-action live end" onClick={()=>void endLiveCall()}>End Live Call</button>
              :<button type="button" className="voice-action live" disabled={liveCallStatus==='connecting'||mode!=='account'} onClick={()=>void startLiveCall()}>{liveCallStatus==='connecting'?'Connecting…':'Start Live Call'}</button>}
            {liveCallStatus==='connected'&&<button type="button" className="voice-action mic" onClick={()=>void toggleLiveMic()}>{liveMicMuted?<><Mic size={14}/> Unmute Mic</>:<><MicOff size={14}/> Mute Mic</>}</button>}
          </div>
          <div className="voice-models"><span><b>Spoken replies</b> · Wistoria · Flash v2.5 · tested</span><span><b>Live call</b> · Wistoria · Flash v2 · GPT-5.6 Sol</span>{liveConversationId&&<span><b>Session</b> · {liveConversationId.slice(0,12)}…</span>}</div>
          <p className="voice-help">{liveCallStatus==='connected'?'Talk normally. Myria can use the current project as context and can save a note when you explicitly ask her to.':'Test Voice confirms you can hear Myria. Start Live Call for a two-way microphone conversation.'}</p>
        </div>

        <div className="myria-loop" aria-label="Myria brainstorming strengths"><span>Brainstorm</span><span>Develop</span><span>Continuity</span><span>Critique</span><span>Refine</span></div>

        <div className="chat-log">{messages.map(m=><div key={m.id} className={`bubble ${m.role}`}><small>{m.role==='assistant'?'Myria':'You'}</small><span>{m.content}</span>{m.role==='assistant'&&<button type="button" className="bubble-speak" onClick={()=>void speakOnDemand(m.content)} title="Speak this reply" aria-label="Speak this reply"><Volume2 size={13}/></button>}</div>)}</div>
        <form className="chat-form" onSubmit={sendMyria}><input value={chat} onChange={e=>setChat(e.target.value)} onFocus={()=>setMyriaStatus('observing')} onBlur={()=>myriaStatus==='observing'&&setMyriaStatus('idle')} placeholder="Brainstorm with Myria…"/><button className="send-btn" aria-label="Send"><Sparkles size={17}/></button></form>
        <div className="quick-actions"><button onClick={()=>sendMyria(undefined,'Give me three genuinely different directions we could take the current project next, with one creative tradeoff for each.')}><Sparkles size={14}/> Brainstorm paths</button><button onClick={()=>sendMyria(undefined,'Scan the current project for continuity problems, unresolved setup, weak motivations, or useful opportunities, then tell me the most important things to address.')}><BookOpen size={14}/> Continuity scan</button></div>
        <div className="goals"><div className="subhead"><strong>Myria goals</strong><span>{goals.length}</span></div>{goals.slice(0,4).map(g=><div className="goal" key={g.id}><span>{g.status}</span><strong>{g.title}</strong><p>{g.reason}</p>{g.tasks.map(task=><div className="goal-task" key={task.id}><div><small>{task.riskLevel} · {task.status} · {task.attempts}/{task.maxAttempts}</small><p>{task.description}</p>{task.verification&&<em>{task.verification}</em>}</div>{!['complete','needs_human_review','waiting_approval'].includes(task.status)&&<button className="mini-run" onClick={()=>void runMyriaTask(g.id,task)}>{task.riskLevel==='low'?'Run':'Request approval'}</button>}</div>)}</div>)}{!goals.length&&<p className="muted-copy">Myria can turn useful next steps into structured project goals.</p>}</div>
      </aside>
    </div>
  </main>

  {modal==='note'&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setModal(null)}><form className="modal" onSubmit={addNote}><button type="button" className="close" onClick={()=>setModal(null)}><X/></button><p className="eyebrow">ADD FRAGMENT</p><h2>New note</h2><label>Title<input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Optional label"/></label><label>Content<textarea required value={newBody} onChange={e=>setNewBody(e.target.value)} placeholder="Write the actual idea here. Redbound uses these words to choose the section."/></label><p className="hint">Routing is inferred from the note body, not the title.</p><button className="primary wide">Save note</button></form></div>}
  {modal==='section'&&<div className="modal-backdrop"><form className="modal small" onSubmit={addSection}><button type="button" className="close" onClick={()=>setModal(null)}><X/></button><p className="eyebrow">CUSTOMIZE THE FORGE</p><h2>Add section</h2><label>Section name<input required value={sectionTitle} onChange={e=>setSectionTitle(e.target.value)} placeholder="Relationships, Timeline, Factions…"/></label><button className="primary wide">Create section</button></form></div>}
  {modal==='profile'&&<div className="modal-backdrop"><form className="modal" onSubmit={saveProfile}><button type="button" className="close" onClick={()=>setModal(null)}><X/></button><p className="eyebrow">PROFILE</p><h2>{mode==='guest'?'Local creator':'Account profile'}</h2><label>Display name<input value={profileName} onChange={e=>setProfileName(e.target.value)}/></label>{mode==='account'&&<label>Avatar URL<input value={profileAvatar} onChange={e=>setProfileAvatar(e.target.value)} placeholder="https://…"/></label>}<label>Bio<textarea value={profileBio} onChange={e=>setProfileBio(e.target.value)}/></label><button className="primary wide">Save profile</button>{mode==='account'&&<button type="button" className="ghost wide" onClick={async()=>{await supabase?.auth.signOut();setMode(null)}}><LogIn size={16}/> Sign out</button>}</form></div>}
  {modal==='collab'&&<div className="modal-backdrop"><div className="modal"><button className="close" onClick={()=>setModal(null)}><X/></button><p className="eyebrow">COLLABORATION</p><h2>Project room</h2>{mode==='guest'?<div className="notice"><CloudOff/><div><strong>Guest projects are private to this device.</strong><p>Create an account to sync and invite collaborators.</p></div></div>:<><p className="hint">Create a private link and send it directly to the person you want to join. The link is the permission: after they sign in, create an account, or use permitted guest access, Redbound adds them automatically. Leave email blank for a first-recipient link, or enter an email to lock it to that account.</p><form onSubmit={invite} className="invite-form"><input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="Optional: collaborator@example.com"/><select value={inviteRole} onChange={e=>setInviteRole(e.target.value as 'editor'|'viewer')}><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button className="primary" disabled={!editable}>Create invite link</button></form>{inviteLink&&<div className="permission-card"><strong>Private invite link</strong><p>{inviteLink}</p><button className="ghost wide" onClick={async()=>{try{await navigator.clipboard.writeText(inviteLink);notify('Invite link copied.')}catch{notify('Copy the link manually.')}}}>Copy link</button></div>}<div className="permission-card"><strong>Your role: {role}</strong><p>{role==='owner'?'Full project authority.':role==='editor'?'Can write, organize, and collaborate.':'Read-only access.'}</p></div></>}</div></div>}
  {toast&&<div className="toast">{toast}</div>}
  </div>
}