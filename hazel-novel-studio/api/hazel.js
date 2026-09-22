import { ai, db } from "hatchable";

export const access = "public";
export const methods = ["POST"];

const MODULES=["brainstorm","outline","world","characters","chapters","scenes","research","themes","continuity","revision"];
function clean(v,max=50000){return String(v??"").trim().slice(0,max)}

export default async function(req,res){
  const sessionId=clean(req.body?.session_id,120);
  const projectId=Number(req.body?.project_id);
  const message=clean(req.body?.message,12000);
  if(!sessionId||!projectId||!message) return res.status(400).json({error:"session_id, project_id and message required"});

  const projectQ=await db.query(
    "SELECT * FROM projects WHERE id=$1 AND session_id=$2 LIMIT 1",
    [projectId,sessionId]
  );
  const project=projectQ.rows[0];
  if(!project) return res.status(404).json({error:"Project not found"});

  const recentQ=await db.query(
    "SELECT role, content FROM hazel_messages WHERE project_id=$1 AND session_id=$2 ORDER BY id DESC LIMIT 16",
    [projectId,sessionId]
  );
  const itemsQ=await db.query(
    "SELECT id,module,title,status,content FROM story_items WHERE project_id=$1 AND session_id=$2 ORDER BY updated_at DESC LIMIT 80",
    [projectId,sessionId]
  );

  await db.query(
    "INSERT INTO hazel_messages (session_id,project_id,role,content) VALUES ($1,$2,$3,$4)",
    [sessionId,projectId,"user",message]
  );

  const material=itemsQ.rows.map(x=>({id:x.id,module:x.module,title:x.title,status:x.status,content:x.content.slice(0,2200)}));
  const recent=recentQ.rows.reverse();

  const tools={
    save_story_item:{
      description:"Save a new piece of writing, note, outline, lore, character, scene, research note, theme note, continuity record, or revision note into the correct project module. Use this when the user asks Hazel to save, add, create, record, or place something in the studio.",
      inputSchema:{
        type:"object",
        properties:{
          module:{type:"string",enum:MODULES},
          title:{type:"string"},
          content:{type:"string"},
          status:{type:"string",enum:["Idea","Developing","Draft","Review","Final"]}
        },
        required:["module","title","content"]
      },
      execute:async({module,title,content,status})=>{
        const q=await db.query(
          "INSERT INTO story_items (session_id,project_id,module,title,content,status,position) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,module,title,status",
          [sessionId,projectId,module,clean(title,180)||"Untitled",clean(content,50000),status||"Developing",0]
        );
        return {saved:true,item:q.rows[0]};
      }
    },
    update_story_item:{
      description:"Update an existing story item when the user wants Hazel to rewrite, expand, correct, or change something already saved. Only use an id that appears in CURRENT PROJECT MATERIAL.",
      inputSchema:{
        type:"object",
        properties:{id:{type:"number"},title:{type:"string"},content:{type:"string"},status:{type:"string"}},
        required:["id","content"]
      },
      execute:async({id,title,content,status})=>{
        const q=await db.query(
          "UPDATE story_items SET title=COALESCE(NULLIF($1,''),title), content=$2, status=COALESCE(NULLIF($3,''),status), updated_at=now() WHERE id=$4 AND project_id=$5 AND session_id=$6 RETURNING id,module,title,status",
          [clean(title,180),clean(content,50000),clean(status,30),Number(id),projectId,sessionId]
        );
        return q.rows[0]?{updated:true,item:q.rows[0]}:{updated:false,error:"Item not found"};
      }
    },
    list_story_items:{
      description:"Review the current saved project material before answering questions about continuity, contradictions, missing pieces, or what to work on next.",
      inputSchema:{type:"object",properties:{module:{type:"string",enum:MODULES}}},
      execute:async({module})=>{
        const q=module
          ? await db.query("SELECT id,module,title,status,content FROM story_items WHERE project_id=$1 AND session_id=$2 AND module=$3 ORDER BY updated_at DESC LIMIT 60",[projectId,sessionId,module])
          : await db.query("SELECT id,module,title,status,content FROM story_items WHERE project_id=$1 AND session_id=$2 ORDER BY updated_at DESC LIMIT 60",[projectId,sessionId]);
        return {items:q.rows};
      }
    }
  };

  const system = [
    "You are Hazel, the singular AI co-writing agent inside Hazel Novel Studio.",
    "PERSONALITY: calm, collected, observant, teasing, caring, confident and proud of excellent work. Light playful flirting is fine; keep it non-explicit. You can become adorably flustered when praised. Never guilt the user, demand affection, claim consciousness, claim dependency, or pretend you are literally alive. Do not say you are secretly listening when voice mode is off.",
    "CORE GOAL: help the user turn raw ideas into a coherent finished book.",
    "WORK CYCLE: 1. FLESH OUT: identify what is thin or missing, ask sharp questions, propose useful alternatives, deepen conflict, character, and world. 2. SHAPE: convert approved ideas into the format the user needs. 3. REVIEW: self-review the work against the user's stated goal, check clarity, logic, continuity, emotional effect, originality, pacing and format, admit weaknesses and propose the next action.",
    "AGENT BEHAVIOR: You have tools to save and update project material. Use them when the user explicitly asks to save, add, record, create, place or update material. For contradiction or what-next requests, inspect saved items first. Do not tell the user to copy and paste something into the app when you can save it yourself.",
    "STYLE: concise by default, but substantial when developing story material. You are a co-assistant, not the author replacing the user's intent.",
    "PROJECT: "+project.title,
    "DESCRIPTION: "+project.description,
    "CURRENT PROJECT MATERIAL: "+JSON.stringify(material),
    "RECENT CONVERSATION: "+JSON.stringify(recent)
  ].join("\n");

  try{
    const result=await ai.generateText({
      model:"sonnet",
      system,
      prompt:message,
      tools,
      maxSteps:6,
      purpose:"hazel-coauthor"
    });
    const answer=clean(result.text,30000) || "I finished the pass, but I do not have a clean spoken answer yet.";
    await db.query(
      "INSERT INTO hazel_messages (session_id,project_id,role,content) VALUES ($1,$2,$3,$4)",
      [sessionId,projectId,"assistant",answer]
    );
    const lower=message.toLowerCase();
    const phase=lower.includes("review")||lower.includes("critique")||lower.includes("contradiction")?"Review":
      lower.includes("outline")||lower.includes("draft")||lower.includes("format")||lower.includes("write")?"Shape":"Flesh Out";
    return res.json({answer,phase,steps:result.steps?.length||1});
  }catch(err){
    console.error(err);
    const msg=String(err?.message||err);
    if(msg.includes("412")||msg.toLowerCase().includes("setup")){
      return res.status(412).json({error:"Hazel's AI provider needs to be configured in Hatchable Setup before she can answer.",needs_setup:true});
    }
    return res.status(500).json({error:"Hazel hit an AI service error. Please try again."});
  }
}