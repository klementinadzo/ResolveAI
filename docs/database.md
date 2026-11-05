# Database

The app's data lives in a Supabase (Postgres) project. Only server code can read or write it.

## How changes are applied

```sh
bun run db:status                 # lists each migration as applied / pending (read-only)
bun run db:apply                  # applies the pending migrations, in order, each in one transaction
bun run db:apply --only <name>    # applies just one pending migration
bun run db:seed                   # loads the demo data (adds only what is missing)
bun run db:seed --reset           # deletes all data first, then loads the demo data fresh
bun run db:types                  # regenerates src/lib/database.types.ts from the schema (read-only)
```

`scripts/db.ts` uses `SUPABASE_DB_URL` and records every applied migration in `app_private.applied_sql`, a private schema the API can't reach. A migration is never applied twice, and the script stops if an applied one was edited: write a new SQL file instead, add it to the list in `scripts/db.ts`, then run `bun run db:types` and commit the result.

## Access

- Every table has row-level security switched on with **no policies**, and the public `anon` / `authenticated` roles have no table permissions. The publishable key gets "permission denied".
- Every user action is a database function (for example `submit_simulated_reply`, `set_ticket_status`) that makes the change and writes its timeline entry in one transaction. Only `service_role` (the server's secret key) may run them.

## Migrations (structure), in order

| File                                                            | What it does                                                                                 |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `drizzle/migrations/0000_customer_success_workspace_schema.sql` | Tables, allowed values, checks and indexes; access locked to the server                      |
| `db/migrations/0002_workspace_actions.sql`                      | Database functions for every user action, resolution notes, draft revisions, AI request log  |
| `db/migrations/0003_ticket_insights.sql`                        | Stores the AI briefing (summary, next steps, reply)                                          |
| `db/migrations/0006_remove_ticket_assignee.sql`                 | Drops ticket assignment (Mara handles every ticket)                                          |
| `db/migrations/0007_no_pending_status.sql`                      | No Pending status: Pending tickets become Open, Pending is refused, a reply keeps the status |
| `db/migrations/0012_insight_optional_prefill.sql`               | Saving an AI briefing can skip filling the draft (used for the refresh after Send)           |

Numbers 0004, 0005, 0008–0011 and 0013 were demo-data changes. They are folded into the seed; `applied_sql` still lists the ones applied earlier, and the script ignores them.

## Demo data

`db/seed/demo_data.sql` is the fictional dataset: 10 accounts, 36 tickets, 45 messages, 5 follow-ups and 42 timeline events. Every date is relative to the day it is loaded (`current_date - 2`, `now() - interval '3 hours'`), so the demo always looks current. Fixed ids and `ON CONFLICT (id) DO NOTHING` mean loading it again never overwrites changes made in the app; `--reset` starts over.

## Types

`src/lib/database.types.ts` is generated from the real schema by `scripts/gen-db-types.ts` (tables, enums and function arguments, in the format `supabase-js` expects). Server code is type-checked against it, so calling a function with a wrong argument fails `tsc`.

## Tests

`src/test/database.test.ts` runs every migration and the seed in an in-memory Postgres ([PGlite](https://pglite.dev)), with Supabase's `anon` / `authenticated` / `service_role` roles, and checks the functions' rules: resolution notes, draft revisions, idempotent replies and follow-ups, AI limits, and that the public roles can't read or run anything. It needs no cloud database and runs in CI with the other tests.

## The `drizzle/` folder

`drizzle/` belongs to Lovable Cloud's own database; Lovable writes those files itself. Only `0000` is used here. Do not run `drizzle-kit push`: `drizzle/schema.ts` is intentionally blank, so it would propose dropping the tables.
