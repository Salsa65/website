'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, Brain, ChevronRight, Download, Globe2, Heart,
  MessageCircle, Mic2, Pencil, Plus, Settings2, Sparkles,
  Sword, Trash2, Volume2, VolumeX, WandSparkles, X
} from 'lucide-react';
import styles from './DuoForgeApp.module.css';

type Speaker = 'Vesper' | 'Arden';
type Mood = 'calm' | 'amused' | 'focused' | 'flustered' | 'protective' | 'excited' | 'annoyed';
type Note = { id:string; title:string; body:string; updatedAt:number };
type ForgeSection = { id:string; title:string; subtitle:string; icon:string; custom?:boolean; notes:Note[] };
type ChatMessage = { id:string; speaker:'You'|Speaker; text:string; emotion?:string; sources?:string[]; createdAt:number };
type InstallPrompt = Event & { prompt:()=>Promise<void>; userChoice:Promise<{outcome:'accepted'|'dismissed'}> };

const STORE_KEY='reforge-duo-mobile-v1';
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
  const leadRef=useRef<Speaker>('Vesper');
  const ambientIndex=useRef(0);
  const speechChain=useRef<Promise<void>>(Promise.resolve());\n  const audioUnlockedRef=useRef(false);

  const activeSection=useMemo(()=>sections.find(s=>s.id===activeSectionId)||null,[sections,activeSectionId]);

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
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/duo-sw.js').catch(()=>undefined);
    const onInstall=(event:Event)=>{event.preventDefault();setInstallPrompt(event as InstallPrompt)};
    window.addEventListener('beforeinstallprompt',onInstall);
    return()=>window.removeEventListener('beforeinstallprompt',onInstall);
  },[]);

  useEffect(()=>{
    try{localStorage.setItem(STORE_KEY,JSON.stringify({sections,messages:messages.slice(-80),theme,webEnabled,ambientOn}))}catch{}
  },[sections,messages,theme,webEnabled,ambientOn]);

  const queueSpeech=useCallback((text:string,speaker:Speaker)=>{
    if(!voiceEnabled||!audioUnlockedRef.current||!text.trim())return;
    speechChain.current=speechChain.current.then(async()=>{
      try{
        setTalking(speaker); setVoiceError('');
        const response=await fetch('/api/duo/voice',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text.slice(0,1200),speaker})});
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
      const history=messages.slice(-12).map(({speaker,text})=>({speaker,text}));\n      const response=await fetch('/api/duo/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message,notes:noteContext(),web:webEnabled,lead,history})});
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
  function unlockAudio(){
    audioUnlockedRef.current=true; setAudioUnlocked(true); setVoiceEnabled(true); setVoiceError('');
    const greeting='Voices online. Try not to look too pleased, Arden.';
    setMessages(prev=>[...prev,{id:uid(),speaker:'Vesper',text:greeting,emotion:'amused',createdAt:Date.now()}]);
    setTimeout(()=>queueSpeech(greeting,'Vesper'),0);
  }

  return <main className={styles.app} data-theme={theme}>
    <BattleBackdrop theme={theme}/>
    {!audioUnlocked&&<button className={styles.audioGate} onClick={unlockAudio}><Volume2 size={20}/><span><strong>Enable companion voices</strong><small>One tap is required by mobile browsers before Vesper and Arden can speak automatically.</small></span></button>}

    <header className={styles.topbar}>
      <button className={styles.brand} onClick={()=>setActiveSectionId(null)} aria-label="Reforge home"><Sword size={19}/><span>REFORGE <b>DUO</b></span></button>
      <div className={styles.topActions}>
        {installPrompt&&<button className={styles.iconText} onClick={installApp}><Download size={16}/>Install</button>}
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
