import {z} from 'zod';
export const runtime='nodejs';
const Schema=z.object({text:z.string().min(1).max(3000)});
export async function POST(req:Request){
 try{
  const {text}=Schema.parse(await req.json());
  const key=process.env.ELEVENLABS_API_KEY;
  if(!key)return new Response(JSON.stringify({error:'Voice is not configured on the server.'}),{status:503,headers:{'content-type':'application/json'}});
  const voice=process.env.ELEVENLABS_VOICE_ID||'KBiqSCotcD7IzLEkC5z6';
  const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':key,'content-type':'application/json','accept':'audio/mpeg'},body:JSON.stringify({text,model_id:'eleven_multilingual_v2',voice_settings:{stability:.48,similarity_boost:.78,style:.28,use_speaker_boost:true}})});
  if(!r.ok)return new Response(JSON.stringify({error:`ElevenLabs unavailable (${r.status})`}),{status:502,headers:{'content-type':'application/json'}});
  return new Response(r.body,{headers:{'content-type':'audio/mpeg','cache-control':'no-store'}});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:'Speech failed'}),{status:400,headers:{'content-type':'application/json'}});}
}
