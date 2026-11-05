// Applies the project's SQL to your own Supabase database.
//
//   bun run db:status   list each migration and whether it has been applied
//   bun run db:apply    apply the migrations not applied yet (each in its own transaction)
//   bun run db:apply --only <name>   apply just that pending migration (e.g. to skip one awaiting a decision)
//   bun run db:seed     load the demo data (inserts only what is missing)
//   bun run db:seed --reset          delete all accounts, tickets, follow-ups and history first
//
// Needs SUPABASE_DB_URL in .env.local (git-ignored): the "Session pooler" connection
// string from Supabase → Project Settings → Database. It is never printed.
// Applied migrations are recorded in app_private.applied_sql (not reachable through the API).
// Records of SQL files that are no longer listed (the old data-only files) are ignored.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";

/** Structure changes, in order, applied once each. Never edit one after it is applied. */
export const MIGRATIONS = [
  { name: "0000_schema", path: "drizzle/migrations/0000_customer_success_workspace_schema.sql" },
  { name: "0002_workspace_actions", path: "db/migrations/0002_workspace_actions.sql" },
  { name: "0003_ticket_insights", path: "db/migrations/0003_ticket_insights.sql" },
  { name: "0006_remove_ticket_assignee", path: "db/migrations/0006_remove_ticket_assignee.sql" },
  { name: "0007_no_pending_status", path: "db/migrations/0007_no_pending_status.sql" },
  {
    name: "0012_insight_optional_prefill",
    path: "db/migrations/0012_insight_optional_prefill.sql",
  },
] as const;

/** Fictional demo data; loads after the migrations and can be loaded again. */
export const SEED_FILE = "db/seed/demo_data.sql";

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

async function main() {
  const command = process.argv[2];
  const onlyIndex = process.argv.indexOf("--only");
  const only = onlyIndex > 0 ? process.argv[onlyIndex + 1] : undefined;
  if (onlyIndex > 0 && !MIGRATIONS.some((f) => f.name === only)) {
    console.error(`--only needs one of: ${MIGRATIONS.map((f) => f.name).join(", ")}`);
    process.exit(2);
  }
  if (command !== "status" && command !== "apply" && command !== "seed") {
    console.error("Usage: bun scripts/db.ts <status|apply|seed>");
    process.exit(2);
  }
  const url = process.env["SUPABASE_DB_URL"];
  if (!url) {
    console.error("SUPABASE_DB_URL is not set. Add it to .env.local (see .env.local.example).");
    process.exit(1);
  }

  const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
  try {
    console.log(`Database host: ${new URL(url).hostname}`);
    if (command === "seed") {
      const reset = process.argv.includes("--reset");
      await sql.begin(async (tx) => {
        // Everything else references accounts with ON DELETE CASCADE.
        if (reset) await tx`delete from public.accounts`;
        await tx.unsafe(readFileSync(SEED_FILE, "utf8")).simple();
      });
      console.log(reset ? "Demo data reset." : "Demo data loaded (existing rows kept).");
      return;
    }
    if (command === "apply") {
      await sql`create schema if not exists app_private`;
      await sql`revoke all on schema app_private from public`;
      await sql`create table if not exists app_private.applied_sql (
        name text primary key, sha256 text not null, applied_at timestamptz not null default now())`;
    }
    // `status` only reads: before the first apply there is no record table yet.
    const [check] = await sql<
      { exists: boolean }[]
    >`select to_regclass('app_private.applied_sql') is not null as exists`;
    const rows = check?.exists
      ? await sql<
          { name: string; sha256: string }[]
        >`select name, sha256 from app_private.applied_sql`
      : [];
    const applied = new Map(rows.map((r) => [r.name, r.sha256]));

    for (const file of MIGRATIONS) {
      const text = readFileSync(file.path, "utf8");
      const hash = sha256(text);
      const previous = applied.get(file.name);
      if (previous && previous !== hash) {
        throw new Error(
          `${file.path} changed after it was applied. Write a new SQL file instead of editing it.`,
        );
      }
      if (previous) {
        console.log(`  applied   ${file.name}  (${file.path})`);
        continue;
      }
      if (command === "status" || (only && file.name !== only)) {
        console.log(`  pending   ${file.name}  (${file.path})`);
        continue;
      }
      process.stdout.write(`  applying  ${file.name}  (${file.path}) … `);
      await sql.begin(async (tx) => {
        await tx.unsafe(text).simple();
        await tx`insert into app_private.applied_sql (name, sha256) values (${file.name}, ${hash})`;
      });
      console.log("done");
    }
  } finally {
    await sql.end();
  }
}

if (import.meta.main) {
  main().catch((e: unknown) => {
    // Error messages from Postgres never include the connection string.
    console.error(`\nFailed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
}
