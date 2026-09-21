'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, Brain, ChevronRight, Cloud, CloudOff, Download, Globe2, Heart,
  LogIn, LogOut, MessageCircle, Mic2, Pencil, Plus, Settings2, Sparkles,
  Sword, Trash2, Volume2, VolumeX, WandSparkles, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import styles from './DuoForgeApp.module.css';

type Speaker = 'Vesper' | 'Arden';
type Mood = 'calm' | 'amused' | 'focused' | 'flustered' | 'protective' | 'excited' | 'annoyed';
type Note = { id:string; title:string; body:string; updatedAt:number };
type ForgeSection = { id:string; title:string; subtitle:string; icon:string; custom?:boolean; notes:Note[] };
type ChatMessage = { id:string; speaker:'You'|Speaker; text:string; emotion?:string; sources?:string[]; createdAt:number };
type InstallPrompt = Event & { prompt:()=>Promise<void>; userChoice:Promise<{outcome:'accepted'|'dismissed'}> };
type CloudState = 'local'|'syncing'|'synced'|'error';
type AuthMode = 'signin'|'signup';

const STORE_KEY='reforge-duo-mobile-v1';
const BASE_PATH=process.env.NEXT_PUBLIC_BASE_PATH||'';
const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'';
const edgeUrl=(name:string)=>SUPABASE_URL?SUPABASE_URL+'/functions/v1/'+name:'';
const edgeHeaders=()=>({'content-type':'application/json','apikey':SUPABASE_KEY});
const defaultSections:ForgeSection[]=[
  {id:'brainstorm',title:'Brainstorming',subtitle:'Raw ideas, sparks, possibilities.',icon:'✦',notes:[]},
  {id:'outline',title:'Outline',subtitle:'Acts, arcs, chapters, beats.',icon:'◇',notes:[]},
  {id:'characters',title:'Characters',subtitle:'Motives, histories, relationships.',icon:'♟',notes:[]},
  {id:'world',title:'Worldbuilding',subtitle:'Places, cultures, rules, lore.',icon:'◎',notes:[]},
  {id:'plot',title:'Plot Development',subtitle:'Conflicts, reveals, turning points.',icon:'⟡',notes:[]},
  {id:'powers',title:'Power Systems',subtitle:'Abilities, limits, costs, counters.',icon:'⚡',notes:[]},
  {id:'research',title:'Research',subtitle:'Facts, references, web findings.',icon:'⌕',notes:[]},
  {id:'drafts',title:'Writing',subtitle:'Scenes, scripts, rough and final drafts.',icon:'✎',notes:[]},
];

const ambientLines:{speaker:Speaker;text:string;emotion:Mood}[]=[
  {speaker:'Vesper',text:'You have been staring at that idea for a while. Either it is brilliant or it has offended you personally.',emotion:'amused'},
  {speaker:'Arden',text:'Ignore him. Mostly. I think the idea is waiting for you to decide what it is afraid of.',emotion:'focused'},
  {speaker:'Vesper',text:'She says “ignore him” and then steals my point. This relationship is built on intellectual theft.',emotion:'flustered'},
  {speaker:'Arden',text:'You love it. Creator, add one consequence to the idea you are working on. Consequences make stories breathe.',emotion:'amused'},
];

const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2);

function BattleBackdrop({theme}:{theme:string}){
  return <div className={styles.backdrop} data-theme={theme} aria-hidden>
    <div className={styles.stormGlow}/>
    <div className={styles.rain}>{Array.from({length:54},(_,i)=><i key={i} style={{left:(i*37)%101+'%',animationDelay:'-'+((i*0.43)%3.8)+'s',animationDuration:(.7+(i%6)*.09)+'s'}}/>)}</div>
    <svg className={styles.battle} viewBox="0 0 1000 650" role="presentation">
      <defs>
        <filter id="clashGlow"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="holy" x1="0" x2="1"><stop offset="0" stopColor="#fff"/><stop offset="1" stopColor="#c9d8ff"/></linearGradient>
        <linearGradient id="fallen" x1="0" x2="1"><stop offset="0" stopColor="#2b0711"/><stop offset="1" stopColor="#c51f45"/></linearGradient>
      </defs>
      <g className={styles.angelGroup}>
        <g className={styles.lightWing}>
          <path d="M315 270 C170 170 70 205 115 355 C165 300 235 288 305 330 C205 325 150 380 175 465 C225 405 282 380 340 382 C265 410 240 462 270 520 C315 472 350 432 386 395 Z" fill="url(#holy)" opacity=".78"/>
        </g>
        <circle cx="355" cy="250" r="24" fill="#f8f4ff"/>
        <path d="M351 276 C330 316 330 374 350 430 L392 430 C408 370 402 318 379 278 Z" fill="#e9eef8"/>
        <path d="M334 238 C347 210 379 204 397 225" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round"/>
        <ellipse cx="365" cy="206" rx="46" ry="12" fill="none" stroke="#fff" strokeWidth="5" opacity=".9"/>
        <path d="M388 320 L500 350" stroke="#f4f7ff" strokeWidth="12" strokeLinecap="round"/>
      </g>
      <g className={styles.demonGroup}>
        <g className={styles.darkWing}>
          <path d="M690 272 C828 165 940 200 894 355 C838 299 770 290 699 332 C800 324 852 382 826 466 C778 409 717 379 658 382 C735 410 760 463 731 521 C686 470 650 432 614 395 Z" fill="url(#fallen)" opacity=".86"/>
        </g>
        <circle cx="645" cy="250" r="24" fill="#321018"/>
        <path d="M621 277 C599 322 594 371 610 430 L651 430 C673 370 670 319 649 278 Z" fill="#260911"/>
        <path d="M622 231 L595 202 M653 230 L678 198" stroke="#b41f42" strokeWidth="8" strokeLinecap="round"/>
        <path d="M612 320 L500 350" stroke="#b51f42" strokeWidth="12" strokeLinecap="round"/>
      </g>
      <g className={styles.clash} filter="url(#clashGlow)">
        <circle cx="500" cy="350" r="19" fill="#fff"/>
        <path d="M470 321 L531 382 M530 319 L470 383" stroke="#fff" strokeWidth="5"/>
      </g>
    </svg>
    <div className={styles.lightning}/>
    <div className={styles.vignette}/>
  </div>;
}

function CompanionAvatar({speaker,mood,talking}:{speaker:Speaker;mood:Mood;talking:boolean}){
  return <div className={styles.companionAvatar} data-speaker={speaker} data-mood={mood} data-talking={talking}>
    <div className={styles.avatarHalo}/>
    <div className={styles.avatarFace}>{speaker==='Vesper'?'V':'A'}</div>
    <span className={styles.moodTag}>{mood}</span>
  </div>;
}

function CompanionBody({speaker,mood,talking}:{speaker:Speaker;mood:Mood;talking:boolean}){
  const angel=speaker==='Arden';
  return <figure className={styles.bodyAvatar} data-speaker={speaker} data-mood={mood} data-talking={talking}>
    <svg viewBox="0 0 280 520" role="img" aria-label={speaker+' animated companion'}>
      <defs>
        <linearGradient id={speaker+'Wing'} x1="0" x2="1">
          <stop offset="0" stopColor={angel?'#ffffff':'#12060b'}/>
          <stop offset="1" stopColor={angel?'#9fb7ff':'#c5264c'}/>
        </linearGradient>
        <linearGradient id={speaker+'Cloth'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={angel?'#f5f4ff':'#3a101c'}/>
          <stop offset="1" stopColor={angel?'#8899d1':'#10070b'}/>
        </linearGradient>
      </defs>
      <g className={styles.bodyWings}>
        <path className={styles.bodyWingLeft} d="M122 178 C76 98 13 102 15 224 C46 189 78 184 112 206 C60 212 38 257 49 312 C75 274 99 256 125 252 Z" fill={'url(#'+speaker+'Wing)'}/>
        <path className={styles.bodyWingRight} d="M158 178 C204 98 267 102 265 224 C234 189 202 184 168 206 C220 212 242 257 231 312 C205 274 181 256 155 252 Z" fill={'url(#'+speaker+'Wing)'}/>
      </g>
      {angel
        ? <ellipse className={styles.bodyHalo} cx="140" cy="72" rx="48" ry="11" fill="none" stroke="#fff7dd" strokeWidth="5"/>
        : <g className={styles.bodyHorns}><path d="M118 92 Q91 56 104 33" fill="none" stroke="#9e1f3d" strokeWidth="9" strokeLinecap="round"/><path d="M162 92 Q189 56 176 33" fill="none" stroke="#9e1f3d" strokeWidth="9" strokeLinecap="round"/></g>}
      <g className={styles.bodyCore}>
        <path d="M106 115 Q140 86 174 115 L181 173 Q171 202 140 205 Q109 202 99 173 Z" fill={angel?'#efeaff':'#241017'}/>
        <path className={styles.bodyHair} d={angel
          ? "M100 128 Q90 78 140 72 Q194 78 181 147 Q166 115 143 112 Q119 113 100 128 M105 127 Q91 185 106 246 Q125 208 132 166 M176 128 Q191 187 173 244 Q158 211 150 164"
          : "M99 129 Q101 77 141 74 Q184 77 183 131 Q168 112 145 109 Q122 108 99 129 M105 121 Q83 160 96 221 Q111 188 126 156 M177 120 Q199 161 183 220 Q171 184 155 155"} fill={angel?'#f4f0ff':'#171016'}/>
        <ellipse cx="140" cy="133" rx="31" ry="36" fill={angel?'#f6d9d0':'#d5a79d'}/>
        <g className={styles.bodyEyes}>
          <ellipse cx="128" cy="134" rx="4" ry="3" fill={angel?'#d7aa41':'#e72f57'}/>
          <ellipse cx="152" cy="134" rx="4" ry="3" fill={angel?'#d7aa41':'#e72f57'}/>
        </g>
        <path className={styles.bodyMouth} d="M133 151 Q140 155 147 151" fill="none" stroke="#6f3b44" strokeWidth="2" strokeLinecap="round"/>
        <path d="M122 168 L113 207 L82 286 L105 301 L128 232 L129 430 L151 430 L151 232 L175 301 L198 286 L167 207 L158 168 Z" fill={'url(#'+speaker+'Cloth)'} stroke={angel?'#e9e9ff':'#70172c'} strokeWidth="2"/>
        <path d="M127 430 L116 492 L135 493 L141 431 Z M153 430 L145 493 L164 493 L159 430 Z" fill={angel?'#d8d8ec':'#16090d'}/>
        <path d="M82 286 L63 322 L76 329 L105 301 Z M198 286 L217 322 L204 329 L175 301 Z" fill={angel?'#f1d1c6':'#c89990'}/>
      </g>
      <g className={styles.bodyAura}>
        <circle cx="140" cy="209" r="102" fill="none" stroke={angel?'#dce6ff':'#d62c52'} strokeWidth="2" opacity=".22"/>
        <circle cx="140" cy="209" r="122" fill="none" stroke={angel?'#ffffff':'#8e1934'} strokeWidth="1" opacity=".13"/>
      </g>
    </svg>
    <figcaption><strong>{speaker}</strong><span>{talking?'speaking':mood}</span></figcaption>
  </figure>;
}

export default function DuoForgeApp(){
  const [sections,setSections]=useState<ForgeSection[]>(defaultSections);
  const [activeSectionId,setActiveSectionId]=useState<string|null>(null);
  const [messages,setMessages]=useState<ChatMessage[]>([
    {id:'hello-v',speaker:'Vesper',text:'There you are. Arden was pretending she was not waiting for you.',emotion:'amused',createdAt:Date.now()-2},
    {id:'hello-a',speaker:'Arden',text:'I was waiting. I simply have enough dignity not to announce it every six seconds. What are we creating?',emotion:'amused',createdAt:Date.now()-1},
  ]);
  const [input,setInput]=useState('');
  const [busy,setBusy]=useState(false);
  const [voiceEnabled,setVoiceEnabled]=useState(true);
  const [audioUnlocked,setAudioUnlocked]=useState(false);
  const [ambientOn,setAmbientOn]=useState(true);
  const [webEnabled,setWebEnabled]=useState(true);
  const [theme,setTheme]=useState('clash');
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [chatOpen,setChatOpen]=useState(true);
  const [addSectionOpen,setAddSectionOpen]=useState(false);
  const [newSectionTitle,setNewSectionTitle]=useState('');
  const [moods,setMoods]=useState<Record<Speaker,Mood>>({Vesper:'amused',Arden:'focused'});
  const [talking,setTalking]=useState<Speaker|null>(null);
  const [voiceError,setVoiceError]=useState('');
  const [installPrompt,setInstallPrompt]=useState<InstallPrompt|null>(null);
  const [user,setUser]=useState<User|null>(null);
  const [cloudReady,setCloudReady]=useState(false);
  const [cloudState,setCloudState]=useState<CloudState>('local');
  const [authMode,setAuthMode]=useState<AuthMode>('signin');
  const [authEmail,setAuthEmail]=useState('');
  const [authPassword,setAuthPassword]=useState('');
  const [authBusy,setAuthBusy]=useState(false);
  const [authError,setAuthError]=useState('');
  const [authNotice,setAuthNotice]=useState('');
  const leadRef=useRef<Speaker>('Vesper');
  const ambientIndex=useRef(0);
  const speechChain=useRef<Promise<void>>(Promise.resolve());
  const audioUnlockedRef=useRef(false);
  const cloudTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

  const activeSection=useMemo(()=>sections.find(s=>s.id===activeSectionId)||null,[sections,activeSectionId]);

  const applyMemory=useCallback((payload:unknown)=>{
    if(!payload||typeof payload!=='object')return;
    const data=payload as {sections?:ForgeSection[];messages?:ChatMessage[];theme?:string;webEnabled?:boolean;ambientOn?:boolean};
    if(Array.isArray(data.sections)&&data.sections.length)setSections(data.sections);
    if(Array.isArray(data.messages)&&data.messages.length)setMessages(data.messages.slice(-80));
    if(typeof data.theme==='string')setTheme(data.theme);
    if(typeof data.webEnabled==='boolean')setWebEnabled(data.webEnabled);
    if(typeof data.ambientOn==='boolean')setAmbientOn(data.ambientOn);
  },[]);

  const loadCloudMemory=useCallback(async(userId:string)=>{
    if(!supabase)return;
    setCloudReady(false);setCloudState('syncing');
    const {data,error}=await supabase.from('duo_memory').select('payload').eq('user_id',userId).maybeSingle();
    if(error){setCloudState('error');setCloudReady(true);return;}
    if(data?.payload)applyMemory(data.payload);
    setCloudReady(true);setCloudState('synced');
  },[applyMemory]);

  useEffect(()=>{
    try{
      const raw=localStorage.getItem(STORE_KEY);
      if(raw){
        const data=JSON.parse(raw) as {sections?:ForgeSection[];messages?:ChatMessage[];theme?:string;webEnabled?:boolean;ambientOn?:boolean};
        if(Array.isArray(data.sections)&&data.sections.length)setSections(data.sections);
        if(Array.isArray(data.messages)&&data.messages.length)setMessages(data.messages.slice(-80));
        if(data.theme)setTheme(data.theme);
        if(typeof data.webEnabled==='boolean')setWebEnabled(data.webEnabled);
        if(typeof data.ambientOn==='boolean')setAmbientOn(data.ambientOn);
      }
    }catch{}
    if('serviceWorker' in navigator)navigator.serviceWorker.register(BASE_PATH+'/duo-sw.js').catch(()=>undefined);
    const onInstall=(event:Event)=>{event.preventDefault();setInstallPrompt(event as InstallPrompt)};
    window.addEventListener('beforeinstallprompt',onInstall);
    return()=>window.removeEventListener('beforeinstallprompt',onInstall);
  },[]);

  useEffect(()=>{
    try{localStorage.setItem(STORE_KEY,JSON.stringify({sections,messages:messages.slice(-80),theme,webEnabled,ambientOn}))}catch{}
  },[sections,messages,theme,webEnabled,ambientOn]);


  useEffect(()=>{
    if(!supabase){setCloudReady(true);return;}
    let alive=true;
    void (async()=>{
      const {data}=await supabase.auth.getSession();
      if(!alive)return;
      const next=data.session?.user??null;
      setUser(next);
      if(next)await loadCloudMemory(next.id);
      else{setCloudReady(true);setCloudState('local');}
    })();
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(!alive)return;
      const next=session?.user??null;
      setUser(next);
      if(next)queueMicrotask(()=>void loadCloudMemory(next.id));
      else{setCloudReady(true);setCloudState('local');}
    });
    return()=>{alive=false;listener.subscription.unsubscribe();};
  },[loadCloudMemory]);

  useEffect(()=>{
    if(!supabase||!user||!cloudReady)return;
    const client=supabase;
    const currentUser=user;
    if(cloudTimer.current)clearTimeout(cloudTimer.current);
    cloudTimer.current=setTimeout(()=>{
      void (async()=>{
        setCloudState('syncing');
        const payload={version:2,sections,messages:messages.slice(-80),theme,webEnabled,ambientOn};
        const {error}=await client.from('duo_memory').upsert({user_id:currentUser.id,payload,updated_at:new Date().toISOString()},{onConflict:'user_id'});
        setCloudState(error?'error':'synced');
      })();
    },1200);
    return()=>{if(cloudTimer.current)clearTimeout(cloudTimer.current);};
  },[user,cloudReady,sections,messages,theme,webEnabled,ambientOn]);

  const queueSpeech=useCallback((text:string,speaker:Speaker)=>{
    if(!voiceEnabled||!audioUnlockedRef.current||!text.trim())return;
    speechChain.current=speechChain.current.then(async()=>{
      try{
        setTalking(speaker); setVoiceError('');
        const endpoint=edgeUrl('reforge-duo-voice'); if(!endpoint||!SUPABASE_KEY)throw new Error('Cloud voice backend is not configured.');
        const response=await fetch(endpoint,{method:'POST',headers:edgeHeaders(),body:JSON.stringify({text:text.slice(0,1200),speaker})});
        if(!response.ok){const err=await response.json().catch(()=>({error:'Voice request failed'}));throw new Error(err.error||'Voice request failed');}
        const blob=await response.blob(); const url=URL.createObjectURL(blob); const audio=new Audio(url);
        await new Promise<void>((resolve,reject)=>{audio.onended=()=>resolve();audio.onerror=()=>reject(new Error('Audio playback failed'));audio.play().catch(reject)});
        URL.revokeObjectURL(url);
      }catch(err){setVoiceError(err instanceof Error?err.message:'Voice unavailable');}
      finally{setTalking(null)}
    });
  },[voiceEnabled,audioUnlocked]);

  useEffect(()=>{
    if(!ambientOn)return;
    const timer=window.setInterval(()=>{
      if(document.visibilityState!=='visible'||busy||talking)return;
      const line=ambientLines[ambientIndex.current++%ambientLines.length];
      setMessages(prev=>[...prev.slice(-79),{id:uid(),speaker:line.speaker,text:line.text,emotion:line.emotion,createdAt:Date.now()}]);
      setMoods(prev=>({...prev,[line.speaker]:line.emotion}));
      queueSpeech(line.text,line.speaker);
    },70000);
    return()=>window.clearInterval(timer);
  },[ambientOn,busy,talking,queueSpeech]);

  const noteContext=useCallback(()=>{
    const chunks:string[]=[];
    for(const section of sections){
      for(const note of section.notes.slice(0,12)){
        if(note.title.trim()||note.body.trim())chunks.push('['+section.title+'] '+(note.title||'Untitled')+'\n'+note.body.slice(0,2200));
      }
    }
    return chunks.join('\n\n').slice(0,22000);
  },[sections]);

  async function sendChat(e?:FormEvent,quick?:string){
    e?.preventDefault();
    const message=(quick??input).trim(); if(!message||busy)return;
    const userMsg:ChatMessage={id:uid(),speaker:'You',text:message,createdAt:Date.now()};
    setMessages(prev=>[...prev,userMsg]); setInput(''); setBusy(true); setChatOpen(true);
    const lead=leadRef.current; leadRef.current=lead==='Vesper'?'Arden':'Vesper';
    try{
      const history=messages.slice(-12).map(({speaker,text})=>({speaker,text}));
      const endpoint=edgeUrl('reforge-duo-chat'); if(!endpoint||!SUPABASE_KEY)throw new Error('Cloud AI backend is not configured.');
      const response=await fetch(endpoint,{method:'POST',headers:edgeHeaders(),body:JSON.stringify({message,notes:noteContext(),web:webEnabled,lead,history})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'The companions could not answer.');
      const turns=(data.turns||[]) as Array<{speaker:Speaker;text:string;emotion?:Mood}>;
      for(const turn of turns){
        const mood=(turn.emotion||'focused') as Mood;
        setMoods(prev=>({...prev,[turn.speaker]:mood}));
        setMessages(prev=>[...prev,{id:uid(),speaker:turn.speaker,text:turn.text,emotion:mood,sources:data.sources||[],createdAt:Date.now()}]);
        queueSpeech(turn.text,turn.speaker);
      }
    }catch(err){
      const text=err instanceof Error?err.message:'Something went wrong.';
      setMessages(prev=>[...prev,{id:uid(),speaker:'Arden',text:'The connection slipped for a moment: '+text,emotion:'annoyed',createdAt:Date.now()}]);
      setMoods(prev=>({...prev,Arden:'annoyed'}));
    }finally{setBusy(false)}
  }

  function addNote(){
    if(!activeSection)return;
    const note:Note={id:uid(),title:'New note',body:'',updatedAt:Date.now()};
    setSections(prev=>prev.map(s=>s.id===activeSection.id?{...s,notes:[note,...s.notes]}:s));
  }
  function updateNote(id:string,patch:Partial<Note>){
    if(!activeSection)return;
    setSections(prev=>prev.map(s=>s.id===activeSection.id?{...s,notes:s.notes.map(n=>n.id===id?{...n,...patch,updatedAt:Date.now()}:n)}:s));
  }
  function deleteNote(id:string){
    if(!activeSection)return;
    setSections(prev=>prev.map(s=>s.id===activeSection.id?{...s,notes:s.notes.filter(n=>n.id!==id)}:s));
  }
  function renameActive(title:string){
    if(!activeSection)return;
    setSections(prev=>prev.map(s=>s.id===activeSection.id?{...s,title}:s));
  }
  function createSection(){
    const title=newSectionTitle.trim(); if(!title)return;
    const item:ForgeSection={id:uid(),title,subtitle:'Your custom creative space.',icon:'✧',custom:true,notes:[]};
    setSections(prev=>[...prev,item]); setNewSectionTitle(''); setAddSectionOpen(false); setActiveSectionId(item.id);
  }
  async function installApp(){
    if(!installPrompt)return;
    await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null);
  }

  async function submitCloudAuth(e:FormEvent){
    e.preventDefault();if(!supabase)return;
    setAuthBusy(true);setAuthError('');setAuthNotice('');
    try{
      if(authMode==='signup'){
        const {data,error}=await supabase.auth.signUp({email:authEmail,password:authPassword});
        if(error)throw error;
        if(!data.session)setAuthNotice('Account created. Check your email if confirmation is enabled, then sign in.');
      }else{
        const {error}=await supabase.auth.signInWithPassword({email:authEmail,password:authPassword});
        if(error)throw error;
      }
    }catch(error){setAuthError(error instanceof Error?error.message:'Authentication failed.');}
    finally{setAuthBusy(false);}
  }

  async function signOutCloud(){
    if(!supabase)return;
    await supabase.auth.signOut();
    setUser(null);setCloudState('local');setCloudReady(true);
  }

  function unlockAudio(){
    audioUnlockedRef.current=true; setAudioUnlocked(true); setVoiceEnabled(true); setVoiceError('');
    const greeting='Voices online. Try not to look too pleased, Arden.';
    setMessages(prev=>[...prev,{id:uid(),speaker:'Vesper',text:greeting,emotion:'amused',createdAt:Date.now()}]);
    setTimeout(()=>queueSpeech(greeting,'Vesper'),0);
  }

  return <main className={styles.app} data-theme={theme}>
    <BattleBackdrop theme={theme}/>
    <div className={styles.bodyStage} aria-hidden>
      <CompanionBody speaker="Vesper" mood={moods.Vesper} talking={talking==='Vesper'}/>
      <CompanionBody speaker="Arden" mood={moods.Arden} talking={talking==='Arden'}/>
    </div>
    {!audioUnlocked&&<button className={styles.audioGate} onClick={unlockAudio}><Volume2 size={20}/><span><strong>Enable companion voices</strong><small>One tap is required by mobile browsers before Vesper and Arden can speak automatically.</small></span></button>}

    <header className={styles.topbar}>
      <button className={styles.brand} onClick={()=>setActiveSectionId(null)} aria-label="Reforge home"><Sword size={19}/><span>REFORGE <b>DUO</b></span></button>
      <div className={styles.topActions}>
        {installPrompt&&<button className={styles.iconText} onClick={installApp}><Download size={16}/>Install</button>}
        <button className={styles.cloudPill} data-state={cloudState} onClick={()=>setSettingsOpen(true)} title="Memory sync">
          {user?<Cloud size={15}/>:<CloudOff size={15}/>}<span>{user?(cloudState==='syncing'?'Syncing…':cloudState==='error'?'Sync error':'Cloud memory'):'Local memory'}</span>
        </button>
        <button className={styles.iconButton} onClick={()=>setVoiceEnabled(v=>!v)} title="Toggle voices">{voiceEnabled?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>
        <button className={styles.iconButton} onClick={()=>setSettingsOpen(true)} title="Settings"><Settings2 size={18}/></button>
      </div>
    </header>

    <section className={styles.companionStrip}>
      <div className={styles.companionCard} data-speaker="Vesper">
        <CompanionAvatar speaker="Vesper" mood={moods.Vesper} talking={talking==='Vesper'}/>
        <div><strong>Vesper</strong><span>Fallen strategist · {talking==='Vesper'?'speaking':busy?'thinking':moods.Vesper}</span></div>
      </div>
      <div className={styles.relationship}><Heart size={13} fill="currentColor"/><span>partners / rivals</span></div>
      <div className={styles.companionCard} data-speaker="Arden">
        <CompanionAvatar speaker="Arden" mood={moods.Arden} talking={talking==='Arden'}/>
        <div><strong>Arden</strong><span>Angel analyst · {talking==='Arden'?'speaking':busy?'thinking':moods.Arden}</span></div>
      </div>
    </section>

    {!activeSection?<section className={styles.home}>
      <div className={styles.hero}>
        <p><Sparkles size={14}/> TWO MINDS. ONE FORGE.</p>
        <h1>Build worlds while heaven and hell argue over the details.</h1>
        <span>Every section is editable. Your notes become the companions’ project memory, and web search can be used when a question needs current outside information.</span>
        <div className={styles.heroActions}>
          <button onClick={()=>sendChat(undefined,'Look across my notes and give me three strong ideas for what I should develop next.')}><WandSparkles size={17}/>Brainstorm with both</button>
          <button onClick={()=>setChatOpen(true)}><MessageCircle size={17}/>Open conversation</button>
        </div>
      </div>

      <div className={styles.sectionHeading}><div><p>CREATIVE SPACES</p><h2>Your forge</h2></div><button onClick={()=>setAddSectionOpen(true)}><Plus size={16}/>Add section</button></div>
      <div className={styles.sectionGrid}>
        {sections.map(section=><button key={section.id} className={styles.sectionCard} onClick={()=>setActiveSectionId(section.id)}>
          <span className={styles.sectionIcon}>{section.icon}</span>
          <span className={styles.sectionCopy}><strong>{section.title}</strong><small>{section.subtitle}</small><em>{section.notes.length} {section.notes.length===1?'note':'notes'}</em></span>
          <ChevronRight size={18}/>
        </button>)}
      </div>
    </section>:<section className={styles.space}>
      <div className={styles.spaceHead}>
        <button className={styles.backButton} onClick={()=>setActiveSectionId(null)}><ArrowLeft size={18}/>All spaces</button>
        <div className={styles.spaceTitle}><span>{activeSection.icon}</span><div><p>EDITABLE SECTION</p><input value={activeSection.title} onChange={e=>renameActive(e.target.value)} aria-label="Section title"/></div></div>
        <button className={styles.addNote} onClick={addNote}><Plus size={17}/>Add note</button>
      </div>
      <div className={styles.noteGrid}>
        {activeSection.notes.length===0?<div className={styles.emptyNotes}><BookOpen size={28}/><strong>This space is empty.</strong><span>Add a note, then ask Vesper and Arden to challenge it, expand it, research it, or connect it to the rest of the project.</span><button onClick={addNote}><Plus size={16}/>Create first note</button></div>:
        activeSection.notes.map(note=><article className={styles.note} key={note.id}>
          <div className={styles.noteBar}><Pencil size={14}/><span>{new Date(note.updatedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</span><button onClick={()=>deleteNote(note.id)} aria-label="Delete note"><Trash2 size={14}/></button></div>
          <input value={note.title} onChange={e=>updateNote(note.id,{title:e.target.value})} placeholder="Note title"/>
          <textarea value={note.body} onChange={e=>updateNote(note.id,{body:e.target.value})} placeholder="Write freely. This becomes part of the companions’ project context."/>
          <button className={styles.askNote} onClick={()=>sendChat(undefined,'Help me improve the note titled “'+note.title+'” in '+activeSection.title+'. Focus on useful creative development and point out weaknesses.')}>Ask both about this</button>
        </article>)}
      </div>
    </section>}

    <aside className={styles.chatDock} data-open={chatOpen}>
      <button className={styles.chatToggle} onClick={()=>setChatOpen(v=>!v)}><MessageCircle size={18}/><span>{chatOpen?'Hide council':'Open council'}</span></button>
      {chatOpen&&<div className={styles.chatPanel}>
        <div className={styles.chatHead}><div><Brain size={17}/><span><strong>Companion Council</strong><small>{webEnabled?'notes + live web':'notes only'} · two independent replies</small></span></div><button onClick={()=>setChatOpen(false)}><X size={16}/></button></div>
        <div className={styles.chatLog}>
          {messages.slice(-18).map(msg=><div key={msg.id} className={styles.message} data-speaker={msg.speaker}>
            <small>{msg.speaker}{msg.emotion?' · '+msg.emotion:''}</small><p>{msg.text}</p>
            {msg.sources&&msg.sources.length>0&&<div className={styles.sources}>{msg.sources.slice(0,3).map((url,i)=><a key={url+i} href={url} target="_blank" rel="noreferrer"><Globe2 size={10}/>source {i+1}</a>)}</div>}
          </div>)}
          {busy&&<div className={styles.thinking}><i/><i/><i/><span>Vesper and Arden are arguing constructively…</span></div>}
        </div>
        <div className={styles.quickPrompts}>
          <button onClick={()=>sendChat(undefined,'Give me three unexpected directions for this project.')}>Surprise me</button>
          <button onClick={()=>sendChat(undefined,'Find contradictions or weak points in my notes and explain how to strengthen them.')}>Challenge notes</button>
          <button onClick={()=>sendChat(undefined,'Use the web if useful and give me research that could make this story feel more believable.')}>Research</button>
        </div>
        <form className={styles.chatForm} onSubmit={sendChat}><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Talk to both companions…" maxLength={4000}/><button disabled={busy||!input.trim()}><Sparkles size={17}/></button></form>
        {voiceError&&<div className={styles.voiceError}>{voiceError}</div>}
      </div>}
    </aside>

    {settingsOpen&&<div className={styles.modalShade} onClick={()=>setSettingsOpen(false)}><section className={styles.modal} onClick={e=>e.stopPropagation()}>
      <button className={styles.modalClose} onClick={()=>setSettingsOpen(false)}><X size={18}/></button>
      <p className={styles.kicker}>COMPANION SYSTEM</p><h2>Settings</h2>

      <div className={styles.cloudCard}>
        <div className={styles.cloudCardHead}>
          <span>{user?<Cloud size={17}/>:<CloudOff size={17}/>}</span>
          <div><strong>{user?'Cloud memory active':'Local memory mode'}</strong><small>{user?'Notes and recent companion history sync to your Reforge account.':'Your work stays on this device until you sign in.'}</small></div>
        </div>
        {user?
          <div className={styles.signedInRow}><span>{user.email||'Signed-in creator'}</span><button type="button" onClick={signOutCloud}><LogOut size={14}/>Sign out</button></div>:
          <form className={styles.cloudAuth} onSubmit={submitCloudAuth}>
            <div className={styles.authTabs}><button type="button" data-active={authMode==='signin'} onClick={()=>setAuthMode('signin')}>Sign in</button><button type="button" data-active={authMode==='signup'} onClick={()=>setAuthMode('signup')}>Create account</button></div>
            <input type="email" required value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="Email"/>
            <input type="password" minLength={8} required value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="Password"/>
            {authError&&<small className={styles.authError}>{authError}</small>}
            {authNotice&&<small className={styles.authNotice}>{authNotice}</small>}
            <button className={styles.cloudSubmit} disabled={authBusy}><LogIn size={14}/>{authBusy?'Working…':authMode==='signup'?'Create account':'Sign in & sync'}</button>
          </form>}
      </div>

      <label>Interface atmosphere<select value={theme} onChange={e=>setTheme(e.target.value)}><option value="clash">Crimson Clash</option><option value="cathedral">Storm Cathedral</option><option value="abyss">Abyssal Rain</option></select></label>
      <label className={styles.toggleRow}><span><strong>ElevenLabs voices</strong><small>Speak replies automatically after audio is unlocked.</small></span><input type="checkbox" checked={voiceEnabled} onChange={e=>setVoiceEnabled(e.target.checked)}/></label>
      <label className={styles.toggleRow}><span><strong>Ambient couple banter</strong><small>Occasional low-cost local chatter while the app is open.</small></span><input type="checkbox" checked={ambientOn} onChange={e=>setAmbientOn(e.target.checked)}/></label>
      <label className={styles.toggleRow}><span><strong>Live web intelligence</strong><small>Allow the AI backend to search the internet when useful.</small></span><input type="checkbox" checked={webEnabled} onChange={e=>setWebEnabled(e.target.checked)}/></label>
      <div className={styles.settingsNote}><Mic2 size={17}/><span>Voice keys and voice IDs stay on the server. Mobile browsers require one user gesture before automatic audio can begin.</span></div>
    </section></div>}

    {addSectionOpen&&<div className={styles.modalShade} onClick={()=>setAddSectionOpen(false)}><section className={styles.modal} onClick={e=>e.stopPropagation()}>
      <button className={styles.modalClose} onClick={()=>setAddSectionOpen(false)}><X size={18}/></button>
      <p className={styles.kicker}>NEW SPACE</p><h2>Create a section</h2>
      <label>Section name<input autoFocus value={newSectionTitle} onChange={e=>setNewSectionTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')createSection()}} placeholder="Factions, Mythology, Episode Ideas…"/></label>
      <button className={styles.primaryAction} onClick={createSection}><Plus size={17}/>Create section</button>
    </section></div>}
  </main>;
}
