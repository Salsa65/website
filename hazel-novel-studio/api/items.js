import { db } from "hatchable";

export const access = "public";
export const methods = ["GET","POST","PUT","DELETE"];

const MODULES=new Set([
  "brainstorm","outline","world","characters","chapters",
  "scenes","research","themes","continuity","revision"
]);
function clean(v,max=20000){return String(v??"").trim().slice(0,max)}

export default async function(req,res){
  const sessionId=clean(req.method==="GET"?req.query?.session_id:req.body?.session_id,120);
  const projectId=Number(req.method==="GET"?req.query?.project_id:req.body?.project_id);
  if(!sessionId||!projectId) return res.status(400).json({error:"session_id and project_id required"});

  if(req.method==="GET"){
    const q=await db.query(
      "SELECT * FROM story_items WHERE project_id=$1 AND session_id=$2 ORDER BY module, position, updated_at DESC",
      [projectId,sessionId]
    );
    return res.json({items:q.rows});
  }

  if(req.method==="POST"){
    const module=clean(req.body?.module,40);
    if(!MODULES.has(module)) return res.status(400).json({error:"Unknown module"});
    const title=clean(req.body?.title,180)||"Untitled";
    const content=clean(req.body?.content,50000);
    const status=clean(req.body?.status,30)||"Idea";
    const pos=Number.isFinite(Number(req.body?.position))?Number(req.body.position):0;
    const q=await db.query(
      "INSERT INTO story_items (session_id,project_id,module,title,content,status,position) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [sessionId,projectId,module,title,content,status,pos]
    );
    await db.query("UPDATE projects SET updated_at=now() WHERE id=$1 AND session_id=$2",[projectId,sessionId]);
    return res.json({item:q.rows[0]});
  }

  if(req.method==="PUT"){
    const id=Number(req.body?.id);
    const title=clean(req.body?.title,180)||"Untitled";
    const content=clean(req.body?.content,50000);
    const status=clean(req.body?.status,30)||"Idea";
    const module=clean(req.body?.module,40);
    if(!MODULES.has(module)) return res.status(400).json({error:"Unknown module"});
    const pos=Number.isFinite(Number(req.body?.position))?Number(req.body.position):0;
    const q=await db.query(
      "UPDATE story_items SET module=$1,title=$2,content=$3,status=$4,position=$5,updated_at=now() WHERE id=$6 AND project_id=$7 AND session_id=$8 RETURNING *",
      [module,title,content,status,pos,id,projectId,sessionId]
    );
    if(!q.rows[0]) return res.status(404).json({error:"Item not found"});
    await db.query("UPDATE projects SET updated_at=now() WHERE id=$1 AND session_id=$2",[projectId,sessionId]);
    return res.json({item:q.rows[0]});
  }

  const id=Number(req.body?.id);
  await db.query(
    "DELETE FROM story_items WHERE id=$1 AND project_id=$2 AND session_id=$3",
    [id,projectId,sessionId]
  );
  await db.query("UPDATE projects SET updated_at=now() WHERE id=$1 AND session_id=$2",[projectId,sessionId]);
  res.json({ok:true});
}