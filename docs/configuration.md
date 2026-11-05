# Configuration

Names only: never commit values.

- `.env` is committed and contains only public values.
- Local secrets go in the git-ignored `.env.local` (copy `.env.local.example`), which overrides `.env`.
- Secrets must be runtime (server) values, never `VITE_*` variables: those are shipped to the browser.

| Name                                                 | Used for                                                            | Secret?                        |
| ---------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------ |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Not used by the app; Lovable sets them for its own client           | Public                         |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`           | Server                                                              | Public                         |
| `SUPABASE_SERVICE_ROLE_KEY`                          | Server data access (your project's secret key)                      | **Secret**                     |
| `SUPABASE_DB_URL`                                    | `db:apply`, `db:seed`, `db:types` (connection string with password) | **Secret**                     |
| `AI_API_KEY`                                         | AI briefing with Google Gemini (free key from Google AI Studio)     | **Secret**                     |
| `AI_MODEL`                                           | Optional: overrides the AI model                                    | Public                         |
| `APP_SUPABASE_URL`, `APP_SUPABASE_SECRET_KEY`        | Your Supabase project when running on Lovable (take priority)       | URL public, key **secret**     |
| `LOVABLE_API_KEY`                                    | Lovable AI on Lovable's servers, when `AI_API_KEY` is not set       | **Secret**, managed by Lovable |

`GET /api/health` reports only whether these server values are present (true/false), which database is in use (`"target"`) and how many accounts it holds.

## Running in Lovable

Lovable's servers always point `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` at Lovable Cloud's own database. To use your Supabase project there, add these secrets in Lovable (Cloud → Secrets): `APP_SUPABASE_URL` and `APP_SUPABASE_SECRET_KEY`, plus optionally `AI_API_KEY`. They take priority (`src/lib/app-db.server.ts`). Without `AI_API_KEY` the AI uses Lovable AI (`LOVABLE_API_KEY`, free monthly grant).

## AI limits

Set in `src/lib/ai-insight.ts`: 50 AI requests per 24 hours for the whole app, a 30-second wait per ticket, input capped at 6,000 characters, a 20-second timeout and two retries. The provider and model are in `src/lib/ai-gateway.server.ts`.
