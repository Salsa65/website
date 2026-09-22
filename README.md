# Redbound Studio

Redbound Studio is a cross-device RPG-styled creative writing and brainstorming workspace for novels, manga, comics, scripts, games, memoirs, nonfiction, characters, worlds, lore, power systems, outlines, drafts, and final manuscripts.

## Current build

- Responsive web + Android experience.
- Black/crimson/light RPG presentation with cherry blossoms and a light-vs-dark crest.
- Main Ideas, Brainstorming, Outlines, Chapter Planner, Scenes, Characters, Relationships, Worldbuilding, Locations, Lore, Power Systems, Plot Development, Timeline, Continuity, Themes, Research, Rough Draft, Final Draft, Publishing Notes, and custom sections.
- Editable notes, autosave, drag-and-drop organization, focus mode, collaboration links, and owner/editor/viewer permissions.
- Supabase email/password authentication, Google/GitHub OAuth hooks, and local guest mode.
- No email OTP or magic-link login UI.
- Myria voice-first assistant using GPT-5.6 Sol.
- Wistoria narrated TTS using Eleven Flash v2.5.
- Real two-way ElevenLabs live conversation using Myria's live agent and Flash v2.
- Explicit **Test Voice**, **Start Live Call**, mic mute, end-call, transcript, replay, and device-speech fallback controls.
- Myria may save a Redbound note only when the author explicitly asks.
- GitHub Pages, CI, and Android APK workflows.

## Voice configuration

- Reasoning: `gpt-5.6-sol`
- Wistoria voice ID: `KBiqSCotcD7IzLEkC5z6`
- Myria live agent: `agent_1001m34tzemqe3ea4h3fx97vr7b5`
- Narrated text: `eleven_flash_v2_5`
- Live English conversation: `eleven_flash_v2`

The live agent stays on Flash v2 because ElevenLabs currently rejects Flash v2.5 for this English conversational-agent configuration. The API keys remain server-side in the Supabase Edge Function.

## Authentication

Redbound supports Sign In, Create Account, Google OAuth, GitHub OAuth, and Guest mode. Email/password signup includes Create Password and Confirm Password fields. There is no OTP or magic-link login flow.

For immediate email/password account creation without an email-confirmation step, disable **Confirm email** in Supabase Auth.

For this standalone repository add:

`https://salsa65.github.io/redbound-studio/`

to Supabase Auth redirect URLs. Android OAuth continues to use:

`com.reforge.duo://oauth-callback`

## Build

Use Node 22:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

GitHub Pages is configured for `NEXT_PUBLIC_BASE_PATH=/redbound-studio`.

Expected site:

`https://salsa65.github.io/redbound-studio/`

## Android

The **Build Redbound Android APK** workflow creates the `Redbound-Android-APK` artifact containing `Redbound-debug.apk`.

The Android build includes microphone/audio permissions and the OAuth deep link. The package ID intentionally remains `com.reforge.duo` so this build can upgrade the existing Redbound installation.

## Voice check

After signing into a cloud project:

1. Tap **Test Voice** and confirm Wistoria is audible.
2. Tap **Start Live Call** and allow microphone permission.
3. Talk naturally; Myria should respond aloud.
4. Ask for brainstorming directions.
5. Say “save that idea to Characters” to exercise the explicit-save client tool.

The Myria agent has passed a multi-turn brainstorming simulation, and Wistoria has passed a real audio generation test.

## Backend

The repository includes the Supabase migrations and `supabase/functions/reforge-ai/index.ts`. Some internal backend identifiers retain the older `reforge` name for compatibility; user-facing branding is Redbound.

Never commit OpenAI, ElevenLabs, Supabase service-role, signing, or OAuth client secrets.
