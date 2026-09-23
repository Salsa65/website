"use client";
import {useEffect,useState} from "react";
import styles from "./SakuraStudio.module.css";

type Speaker="jasper"|"emma";
export default function SakuraStudio(){
 const [draft,setDraft]=useState(""); const [prompt,setPrompt]=useState(""); const [speaking,setSpeaking]=useState<Speaker|null>(null);
 useEffect(()=>{setDraft(localStorage.getItem("sakura-draft")||"")},[]);
 useEffect(()=>{if(draft)localStorage.setItem("sakura-draft",draft)},[draft]);
 async function speak(speaker:Speaker,text:string){
  setSpeaking(speaker);
  try{const r=await fetch("/api/sakura-voice",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({speaker,text})});if(!r.ok)throw new Error();const url=URL.createObjectURL(await r.blob());const a=new Audio(url);a.onended=()=>{URL.revokeObjectURL(url);setSpeaking(null)};await a.play()}catch{setSpeaking(null)}
 }
 const words=draft.trim()?draft.trim().split(/\s+/).length:0;
 return <main className={styles.shell}>
  <div className={styles.petals}>{Array.from({length:28},(_,i)=><i key={i} style={{left:`${(i*37)%100}%`,animationDelay:`-${i%9}s`}}/>)}</div>
  <header><div><span className={styles.kicker}>SAKURA WRITING STUDIO</span><h1>Where stories bloom.</h1></div><div className={styles.level}>LV. 8 · LOREKEEPER</div></header>
  <nav>{["Studio","Projects","Brainstorm","Outline","Characters","World & Lore","Writing Journey"].map(x=><button key={x}>{x}</button>)}</nav>
  <section className={styles.grid}>
   <article className={styles.editor}><div className={styles.crumb}>THE GLASS KINGDOM / CHAPTER 4</div><input defaultValue="The Garden Beyond the Wall" aria-label="Chapter title"/><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Begin writing…"/><footer><span>{words} words</span><span>Autosaved locally</span></footer></article>
   <aside className={styles.ai}><div className={styles.aiHead}><span>AI COMPANIONS</span><b>ElevenLabs Voice</b></div>
    <div className={styles.companion}><div className={styles.avatar}>J</div><div><h3>Jasper</h3><p>Analytical execution · continuity · pacing</p></div><button onClick={()=>speak("jasper","Jasper online. Give me the scene and I will stress test it.")}>{speaking==="jasper"?"Speaking…":"▶ Voice"}</button></div>
    <div className={styles.companion}><div className={styles.avatar}>E</div><div><h3>Emma</h3><p>Creative intuition · emotion · worldbuilding</p></div><button onClick={()=>speak("emma","Emma here. Let us find the version of this story that feels alive.")}>{speaking==="emma"?"Speaking…":"▶ Voice"}</button></div>
    <div className={styles.chat}><p><b>Emma:</b> I can help turn a spark into a scene.</p><p><b>Jasper:</b> And I will make sure the scene survives contact with logic.</p></div>
    <div className={styles.compose}><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Ask Jasper & Emma…"/><button onClick={()=>{if(prompt.trim()){speak(prompt.toLowerCase().includes("jasper")?"jasper":"emma",prompt);setPrompt("")}}}>Speak</button></div>
   </aside>
  </section>
 </main>
}
