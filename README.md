# Reforge

Reforge is a production-oriented story development workspace built with Next.js, React, TypeScript, Supabase and ElevenLabs.

## Core product

- cinematic black, white and crimson UI with animated falling red petals
- one continuous responsive page for desktop, tablet and mobile
- cloud projects for signed-in users and local guest projects
- brainstorming, outlines, characters, worldbuilding, locations, lore, power systems, plot development, themes, research, rough draft and final draft sections
- editable notes, custom sections and native drag reordering
- autosaved cloud/local persistence
- profiles, collaboration invitations, editor/viewer roles and Supabase RLS
- Myria as the only AI assistant and project manager
- Myria control center with goals/tasks and bounded task metadata
- secure ElevenLabs TTS route using Wistoria (`KBiqSCotcD7IzLEkC5z6`)
- PWA manifest and service worker

## Myria architecture

Myria follows an internal project-management loop:

`OBSERVE → UNDERSTAND → PLAN → CREATE GOALS → BREAK INTO TASKS → PRIORITIZE → EXECUTE/ADVISE → VERIFY → SELF-REVIEW`

The UI never exposes private chain-of-thought. Myria returns concise user-facing reasons and suggestions. Project content is treated as untrusted data rather than instructions. Voice presentation is separate from model reasoning.

## Environment

Copy `.env.example` to `.env.local` for local development. Never commit secrets.

Required for cloud data:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Required for full Myria model responses:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (defaults to `gpt-5.6`)

Required for Wistoria speech:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID` (defaults to `KBiqSCotcD7IzLEkC5z6`)

The OpenAI and ElevenLabs keys are read only in server route handlers. They must never use a `NEXT_PUBLIC_` prefix.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

## Database

The current production schema lives in `supabase/migrations/20260921_reforge.sql`. All exposed public tables use Row Level Security. Project access is derived from `project_members` roles. A project-creation trigger creates the standard Reforge story sections automatically.

## Authentication

The UI includes Sign In, Create Account, Continue as Guest and Administrator Login. Administrator Login uses Supabase email/password authentication and then verifies `profiles.role = 'admin'`. Promote an account to administrator through a trusted database/admin path; do not allow a browser client to self-promote.

## Voice behavior

`POST /api/speech` calls ElevenLabs from the server and returns MP3 audio. The browser supports mute/unmute, aborting an in-flight speech request, interrupting playback and natural fallback to text if the speech service is unavailable. Wistoria is the default voice.

## Deployment

Deploy to Vercel with the required environment variables configured as encrypted project environment variables. The Supabase publishable key is intentionally client-visible; service-role keys are never required by this frontend.
