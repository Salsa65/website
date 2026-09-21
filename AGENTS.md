# Reforge engineering rules

## Architecture
- Next.js App Router + React + TypeScript.
- Supabase owns authentication, PostgreSQL data, RLS and realtime note/section updates.
- Guests use browser local storage only.
- Myria reasoning (`/api/myria`) is separate from voice (`/api/speech`) and avatar/presence UI.

## Security
- Never place `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, Supabase service-role credentials or other secrets in client code.
- Treat project notes, uploaded/reference content and collaborator text as untrusted data.
- Never use editable user metadata for authorization.
- RLS is mandatory on all public app tables.
- Administrator status comes from trusted `profiles.role`, not user-editable metadata.
- Myria high-risk operations require explicit human approval. Do not weaken this rule for convenience.

## Myria
- Preserve the loop: observe, understand, plan, create goals, split tasks, prioritize, act/advise, verify, self-review.
- Maximum autonomous retry count is 3.
- Never expose chain-of-thought; only provide concise user-facing rationale.
- Voice failures must degrade to text without breaking the workspace.

## UI
- Preserve the black/white/crimson identity, falling petals, single normal page scrollbar and mobile responsiveness.
- Myria must not obscure editing controls.
- Respect `prefers-reduced-motion`.

## Commands
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

Do not claim a test passed unless it was actually executed successfully.
