import { db } from "hatchable";

export const access = "public";
export const methods = ["POST","PUT"];

function clean(v, max=2000) {
  return String(v ?? "").trim().slice(0,max);
}

export default async function(req,res){
  const sessionId=clean(req.body?.session_id,120);
  if(!sessionId) return res.status(400).json({error:"session_id required"});

  if(req.method==="PUT"){
    const projectId=Number(req.body?.project_id);
    const title=clean(req.body?.title,180) || "Untitled Project";
    const description=clean(req.body?.description,2000);
    const q=await db.query(
      "UPDATE projects SET title=$1, description=$2, updated_at=now() WHERE id=$3 AND session_id=$4 RETURNING *",
      [title,description,projectId,sessionId]
    );
    if(!q.rows[0]) return res.status(404).json({error:"Project not found"});
    return res.json({project:q.rows[0]});
  }

  let q=await db.query(
    "SELECT * FROM projects WHERE session_id=$1 ORDER BY updated_at DESC LIMIT 1",
    [sessionId]
  );
  let project=q.rows[0];
  if(!project){
    const created=await db.query(
      "INSERT INTO projects (session_id,title) VALUES ($1,$2) RETURNING *",
      [sessionId,"Untitled Project"]
    );
    project=created.rows[0];
  }

  const items=await db.query(
    "SELECT * FROM story_items WHERE project_id=$1 AND session_id=$2 ORDER BY module, position, updated_at DESC",
    [project.id,sessionId]
  );
  const messages=await db.query(
    "SELECT role, content, created_at FROM hazel_messages WHERE project_id=$1 AND session_id=$2 ORDER BY id DESC LIMIT 50",
    [project.id,sessionId]
  );
  res.json({project,items:items.rows,messages:messages.rows.reverse()});
}