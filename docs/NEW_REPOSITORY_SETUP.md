# Redbound Studio new repository setup

This branch is prepared to become a standalone repository named `redbound-studio`.

- GitHub Pages base path: `/redbound-studio`
- Expected site: `https://salsa65.github.io/redbound-studio/`
- Android package ID remains `com.reforge.duo` so builds can upgrade the existing Redbound app.
- Myria reasoning: GPT-5.6 Sol.
- Narrated voice: Wistoria + Eleven Flash v2.5.
- Live voice: Myria ElevenLabs agent + Wistoria + Flash v2.
- Live sessions are signed by the Supabase `reforge-ai` Edge Function.
- Add `https://salsa65.github.io/redbound-studio/` to Supabase Auth redirect URLs.
- Google/GitHub OAuth provider credentials still live in Supabase Auth; no OTP/magic-link login is implemented.
