import { NextRequest, NextResponse } from 'next/server';
const DEFAULT_VOICE='KBiqSCotcD7IzLEkC5z6';
export async function POST(req:NextRequest){
  const apiKey=process.env.ELEVENLABS_API_KEY;
  if(!apiKey)return NextResponse.json({error:'ElevenLabs voice is not configured.'},{status:503});
  const body=await req.json().catch(()=>null) as null|{text?:string};
  const text=body?.text?.trim();
  if(!text)return NextResponse.json({error:'Text required'},{status:400});
  if(text.length>3000)return NextResponse.json({error:'Text is too long for speech.'},{status:413});
  const voiceId=process.env.ELEVENLABS_VOICE_ID||DEFAULT_VOICE;
  const upstream=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':apiKey,'content-type':'application/json','accept':'audio/mpeg'},body:JSON.stringify({text,model_id:'eleven_multilingual_v2',voice_settings:{stability:0.48,similarity_boost:0.78,style:0.28,use_speaker_boost:true}})});
  if(!upstream.ok){console.error('ElevenLabs error',upstream.status,(await upstream.text()).slice(0,500));return NextResponse.json({error:'Myria voice is temporarily unavailable.'},{status:502});}
  return new NextResponse(upstream.body,{headers:{'content-type':'audio/mpeg','cache-control':'no-store'}});
}
