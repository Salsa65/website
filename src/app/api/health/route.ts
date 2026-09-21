import {NextResponse} from 'next/server';
export const runtime='nodejs';
export async function GET(){return NextResponse.json({ok:true,myria:Boolean(process.env.OPENAI_API_KEY),voice:Boolean(process.env.ELEVENLABS_API_KEY),voiceId:process.env.ELEVENLABS_VOICE_ID||'KBiqSCotcD7IzLEkC5z6'});}
