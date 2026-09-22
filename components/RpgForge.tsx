'use client';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Dumbbell, Flame, Home, Library, PenLine, Shield, Sparkles, UserRound } from 'lucide-react';
import styles from './RpgForge.module.css';

type Quest={id:string;label:string;xp:number;done:boolean};
type Log={id:string;kind:'write'|'train';label:string;xp:number;at:number};
const KEY='redbound-rpg-v1';
const baseQuests:Quest[]=[
 {id:'workout',label:'Complete a workout',xp:100,done:false},
 {id:'words',label:'Write 300 words',xp:60,done:false},
 {id:'note',label:'Read or edit a note',xp:40,done:false},
 {id:'stretch',label:'10 minutes of stretching',xp:20,done:false},
 {id:'plan',label:'Plan your next chapter',xp:40,done:false},
];

export default function RpgForge(){
 const [xp,setXp]=useState(340),[quests,setQuests]=useState(baseQuests),[logs,setLogs]=useState<Log[]>([]);
 const [words,setWords]=useState(0),[draft,setDraft]=useState(''),[exercise,setExercise]=useState('Strength training');
 useEffect(()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v){setXp(v.xp??340);setQuests(v.quests??baseQuests);setLogs(v.logs??[]);setDraft(v.draft??'');setWords(v.words??0)}}catch{}},[]);
 useEffect(()=>{localStorage.setItem(KEY,JSON.stringify({xp,quests,logs,draft,words}))},[xp,quests,logs,draft,words]);
 const level=Math.floor(xp/1000)+1, progress=xp%1000;
 const stats=useMemo(()=>({Strength:18+logs.filter(x=>x.kind==='train').length,Endurance:16,Focus:20+Math.floor(words/500),Creativity:25+Math.floor(words/300),Discipline:22+quests.filter(q=>q.done).length,Wisdom:19+Math.floor(words/1000)}),[logs,words,quests]);
 function complete(q:Quest){if(q.done)return;setXp(x=>x+q.xp);setQuests(v=>v.map(x=>x.id===q.id?{...x,done:true}:x));setLogs(v=>[{id:crypto.randomUUID(),kind:q.id==='workout'||q.id==='stretch'?'train':'write',label:q.label,xp:q.xp,at:Date.now()},...v])}
 function logWorkout(){setXp(x=>x+100);setLogs(v=>[{id:crypto.randomUUID(),kind:'train',label:exercise,xp:100,at:Date.now()},...v]);setQuests(v=>v.map(q=>q.id==='workout'?{...q,done:true}:q))}
 function saveWriting(){const n=draft.trim()?draft.trim().split(/\s+/).length:0;setWords(n);const gain=Math.max(10,Math.floor(n/100)*20);setXp(x=>x+gain);setLogs(v=>[{id:crypto.randomUUID(),kind:'write',label:`Writing session · ${n} words`,xp:gain,at:Date.now()},...v]);if(n>=300)setQuests(v=>v.map(q=>q.id==='words'?{...q,done:true}:q))}
 return <main className={styles.shell}>
  <header><div className={styles.crest}>☼<span>†</span>☾</div><div><small>WRITE · TRAIN · EVOLVE</small><h1>REDBOUND</h1></div><div className={styles.level}>LV. {level}</div></header>
  <section className={styles.hero}><div><p>Good morning, Hero</p><h2>Discipline shapes the story you live.</h2></div><div className={styles.xp}><b>{progress} / 1,000 EXP</b><i><span style={{width:`${progress/10}%`}}/></i></div></section>
  <section className={styles.duality}><div className={styles.darkWing}>◥</div><div><Shield/><b>SAME SOUL</b><span>DIFFERENT PATHS</span><em>A STRONGER YOU</em></div><div className={styles.lightWing}>◤</div></section>
  <div className={styles.grid}>
   <section className={styles.panel}><h3><Sparkles/> RPG STAT SHEET</h3>{Object.entries(stats).map(([k,v])=><div className={styles.stat} key={k}><span>{k}</span><b>{v}</b></div>)}</section>
   <section className={styles.actions}><button onClick={logWorkout}><Dumbbell/><b>TRAIN</b><span>Log workouts · Gain strength · Level up</span></button><button onClick={()=>document.getElementById('writer')?.scrollIntoView({behavior:'smooth'})}><BookOpen/><b>WRITE</b><span>Take notes · Build worlds · Create stories</span></button></section>
   <section className={styles.panel}><h3><Flame/> DAILY QUESTS</h3>{quests.map(q=><button className={styles.quest} key={q.id} onClick={()=>complete(q)}><span className={q.done?styles.checked:''}>{q.done?'✓':''}</span><label>{q.label}</label><b>+{q.xp} EXP</b></button>)}</section>
  </div>
  <div className={styles.grid}>
   <section className={styles.panel}><h3><Dumbbell/> WORKOUT TRACKING</h3><select value={exercise} onChange={e=>setExercise(e.target.value)}><option>Strength training</option><option>Cardio</option><option>HIIT</option><option>Flexibility</option><option>Custom workout</option></select><button className={styles.primary} onClick={logWorkout}>Complete workout · +100 EXP</button></section>
   <section id="writer" className={styles.panel}><h3><PenLine/> NOVEL CREATION</h3><textarea value={draft} onChange={e=>{setDraft(e.target.value);setWords(e.target.value.trim()?e.target.value.trim().split(/\s+/).length:0)}} placeholder="Write a scene, note, character idea, worldbuilding entry, or chapter…"/><div className={styles.writerFoot}><span>{words} words</span><button className={styles.primary} onClick={saveWriting}>Save session + EXP</button></div></section>
   <section className={styles.panel}><h3><Library/> ADVENTURE LOG</h3>{logs.slice(0,6).map(l=><div className={styles.log} key={l.id}><span>{l.kind==='train'?'⚔':'✦'} {l.label}</span><b>+{l.xp}</b></div>)}{!logs.length&&<p className={styles.muted}>Your first quest awaits.</p>}</section>
  </div>
  <blockquote>“A stronger body creates a sharper mind. A deeper story creates a truer you.”</blockquote>
  <nav><button><Home/>Home</button><button><Dumbbell/>Train</button><button><BookOpen/>Write</button><button><Library/>Library</button><button><UserRound/>Profile</button></nav>
 </main>
}