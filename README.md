# Redbound — RPG Author Studio

Redbound is now a cross-device RPG-styled book creation workspace for the web and Android. The main route uses the cloud-capable writing engine with Myria as the persistent assistant, while the prior workout-oriented implementation remains in repository history.

## Current author-studio experience

- Build novels, manga, comics, memoirs, nonfiction, poetry, scripts, lore books, and other long-form projects.
- Default sections cover Main Ideas, Brainstorming, Outlines, Chapter Planner, Scenes, Characters, Relationships, Worldbuilding, Locations, Lore, Power Systems, Plot Development, Timeline, Continuity, Themes, Research, Rough Draft, Final Draft, and Publishing Notes.
- Custom sections can be added at any time. Selecting a section enters a focused workspace and provides a Back to Main Menu control.
- Cherry blossoms fall across a moonlit RPG interface and land over a reflective pond/ripple scene.
- Signed-in projects use Supabase for cross-device project data, Myria conversation history, structured goals/tasks, and collaboration. Guest mode stays local to one device.
- Myria receives an explicit bounded Plan → Act → Review → Revise → Self-review workflow instruction before each response.
- Opt-in continuous microphone listening uses the Web Speech API when supported. It automatically restarts after normal recognition endings and ignores speech-recognition events while Myria is talking to reduce feedback loops.
- Myria's spoken replies continue to use the configured secure voice action through the Supabase Edge Function. Secrets are not committed to client code.
- The same main route is exported into the Capacitor Android build, so the web UI and APK share the same application experience.

## Android APK

The **Build Redbound Android APK** workflow runs on main-branch changes to the app and produces the **Redbound-Android-APK** artifact containing `Redbound-debug.apk`. This debug APK is intended for sideload testing. A production Play Store release still requires a protected signing key and release-version management.

## Voice and memory boundaries

Always-listening mode is opt-in and depends on browser/WebView speech-recognition support plus microphone permission. On unsupported WebViews, text chat remains available. Cross-device memory requires a signed-in cloud account; guest data does not automatically transfer between devices.

---



The main route is a local-first RPG writing and workout app. The older Duo workspace remains at `/duo/`.

## Current Redbound features

- Home, Train, Write, Library and Profile navigation.
- Multiple story projects; editable notes and chapters, custom sections, full-text search, section-specific add buttons, drag-and-drop and recoverable archiving.
- Automatic local saving with visible errors; migration preserves the earlier dashboard draft and XP.
- Editable workout history, repeatable templates, personal records, minutes, sets, reps, weight, distance, rest and notes. Corrections preserve original XP.
- Shared XP with configurable rules, activity-gated daily/custom quests, writing/training/hybrid paths, streaks, achievements, titles, hero crests and alignment choices.
- Default rules: writing awards 20 XP per new 100-word milestone per entry, capped at 600/day. Existing words cannot earn XP on repeat saves. Training awards 100 XP for 10+ minutes or 20 XP for shorter sessions, capped at 300/day. Quests award separate bonuses once per local calendar day.
- Versioned offline app caching and bundled Android assets. The website must load successfully online once before offline use.
- Validated JSON backup export/import. Data is local to each browser/device, with no cloud synchronization in Redbound yet.

## Build and verify

Use Node 22, then `npm ci`. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. For GitHub Pages, build with `NEXT_PUBLIC_BASE_PATH=/website`.

## Android

`npm run build:mobile` exports Redbound into `mobile-dist`. Then run `npx cap add android`, `npx cap sync android`, `npm run android:assets`, and `cd android && ./gradlew assembleDebug` (Java 21 and Android SDK required). On subsequent builds skip `cap add`. The package ID remains `com.reforge.duo` to preserve the existing Android app identity; its display name is Redbound.

The **Build Redbound Android APK** GitHub Actions workflow builds the debug APK on main changes and manual runs. Download **Redbound-Android-APK** from a successful run and extract `Redbound-debug.apk`. A debug build is for sideload testing. Store releases require a protected signing key, a release build and version management; signing keys must never be committed. Verify on a physical Android device before distributing a release.

## Delivery status and boundaries

The local-first writing/training implementation and Android project are ready for CI. The website and APK are published through GitHub Actions. Check the latest successful workflow run before installing an APK. Local verification covers TypeScript, lint, unit/DOM interaction tests, the production export, Capacitor synchronization and launcher resource generation. A live browser check could not run because the available browser cannot reach the local preview. No physical-device test has been performed.

No cloud backend is configured for Redbound. Backups move data between devices. This dashboard does not expose an AI assistant; the archived architecture below describes the older Reforge workspace, not cloud/AI features of the new dashboard. RPG HP/MP are fantasy character capacity and never medical or workout-readiness measurements.

---

# Reforge

Reforge is a production-oriented story-development workspace built with Next.js, TypeScript, Supabase/PostgreSQL, OpenAI for Myria's reasoning service, and ElevenLabs for Myria's Wistoria voice.

## Core behavior

- One continuous cinematic black/white/crimson interface with animated red petals.
- Responsive desktop/tablet/mobile layouts and installable PWA metadata/service worker.
- Guest mode uses browser-local persistence and requires no account.
- Registered users use Supabase Auth plus PostgreSQL persistence and row-level security.
- Projects include Brainstorming, Outlines, Characters, Worldbuilding, Locations, Lore, Power Systems, Plot Development, Themes, Research, Rough Draft, and Final Draft sections.
- Notes autosave while typing and can be dragged onto section tabs.
- New notes are categorized from the **body content**, not their title.
- Collaboration has owner/editor/viewer roles enforced by PostgreSQL RLS.
- Myria is the only AI assistant. Her reasoning layer and voice presentation layer are independent.
- Myria can create structured project goals/tasks; tasks are bounded to a maximum of three autonomous attempts by architecture.
- ElevenLabs speech is generated by a server-only route. `ELEVENLABS_API_KEY` is never exposed to client JavaScript.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Fill in the Supabase URL/publishable key and server-only AI secrets.
4. Run `npm run dev`.

Required environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=KBiqSCotcD7IzLEkC5z6
```

Only the two `NEXT_PUBLIC_` Supabase values are browser-visible. Supabase publishable keys are designed for client use; access is enforced by RLS. Never prefix `OPENAI_API_KEY` or `ELEVENLABS_API_KEY` with `NEXT_PUBLIC_`.

## Myria architecture

The app keeps these concerns separate:

`project state -> observation/context -> model reasoning -> structured suggestion -> goals/tasks -> verification state`

and independently:

`assistant text -> speech queue -> secure /api/voice -> ElevenLabs -> browser audio state`

Myria never needs an API key in the browser. New user messages interrupt current speech, and queued speech is processed serially.

## Authentication

- **Sign In** and **Create Account** use Supabase Auth.
- **Continue as Guest** keeps core writing features available locally.
- There is no administrator login or hidden administrator bypass.
- Private access is granted through existing project membership or a valid invite link.
- Invite recipients can join without a manual approval step after authentication.

## Collaboration

Project membership is stored in `project_members`. RLS gates reading/writing by membership and role. Project invites are email-bound and accepted through `accept_project_invite`; the function verifies the signed-in user's JWT email before adding membership.

## Database

The canonical schema is in `supabase/migrations/20260921_reforge_production.sql`. All exposed user-data tables use RLS. Authorization helpers live in a non-exposed `private` schema and execute only for authenticated users.

## Verification

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Database/RLS checks should also be run against Supabase after schema changes, including the Supabase security advisor.

## Deployment

Deploy on Vercel or another Node-compatible platform. Configure all environment variables in the deployment secret store. Never commit `.env.local` or API secrets.
