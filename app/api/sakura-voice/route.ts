import { NextRequest, NextResponse } from "next/server";

const VOICES={jasper:"tCV4E5u2H0KI1sCAjfwT",emma:"5tq8quRG2AFvmKjmovKP"} as const;

export async function POST(req:NextRequest){
  const key=process.env.ELEVENLABS_API_KEY;
  if(!key)return NextResponse.json({error:"ELEVENLABS_API_KEY is not configured"},{status:503});
  const body=await req.json();
  const speaker=String(body.speaker||"").toLowerCase() as keyof typeof VOICES;
  const text=String(body.text||"").trim().slice(0,5000);
  if(!VOICES[speaker]||!text)return NextResponse.json({error:"Valid speaker and text required"},{status:400});
  const r=await fetch("https://api.elevenlabs.io/v1/text-to-speech/"+VOICES[speaker],{method:"POST",headers:{"xi-api-key":key,"Content-Type":"application/json","Accept":"audio/mpeg"},body:JSON.stringify({text,model_id:"eleven_multilingual_v2"})});
  if(!r.ok)return NextResponse.json({error:"ElevenLabs request failed"},{status:r.status});
  return new NextResponse(await r.arrayBuffer(),{headers:{"Content-Type":"audio/mpeg","Cache-Control":"no-store"}});
}
