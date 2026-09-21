export const runtime = 'nodejs';

type Speaker = 'Vesper' | 'Arden';

export async function POST(request: Request) {
  try {
    const { text, speaker } = await request.json() as { text?: string; speaker?: Speaker };
    const cleanText = (text || '').trim().slice(0, 1600);
    if (!cleanText) return Response.json({ error: 'Text is required.' }, { status: 400 });

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return Response.json({ error: 'ELEVENLABS_API_KEY is not configured.' }, { status: 503 });

    const male = process.env.ELEVENLABS_VOICE_ID_MALE || process.env.ELEVENLABS_VOICE_ID || '';
    const female = process.env.ELEVENLABS_VOICE_ID_FEMALE || '';
    const voiceId = speaker === 'Arden' ? female : male;
    if (!voiceId) {
      return Response.json({ error: 'The ' + (speaker === 'Arden' ? 'female' : 'male') + ' ElevenLabs voice ID is not configured.' }, { status: 503 });
    }

    const upstream = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voiceId) + '/stream?output_format=mp3_44100_128',
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
          voice_settings: {
            stability: speaker === 'Arden' ? 0.44 : 0.5,
            similarity_boost: 0.78,
            style: speaker === 'Arden' ? 0.42 : 0.34,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!upstream.ok) {
      const detail = await upstream.text().catch(()=>'');
      return Response.json({ error: 'ElevenLabs voice request failed. ' + detail.slice(0, 180) }, { status: upstream.status });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'audio/mpeg',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Voice request failed.' }, { status: 500 });
  }
}
