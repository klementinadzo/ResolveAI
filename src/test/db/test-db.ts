import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { MIGRATIONS, SEED_FILE } from "../../../scripts/db";

/**
 * A throwaway Postgres in memory (PGlite), set up like the real project:
 * Supabase's roles, every migration in order, then the demo data.
 */
export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  // Supabase creates these roles; the migrations grant and revoke access for them.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
  `);
  for (const m of MIGRATIONS) await db.exec(readFileSync(m.path, "utf8"));
  await db.exec(readFileSync(SEED_FILE, "utf8"));
  return db;
}

/**
 * The Postgres error a statement fails with ({} if it succeeds). Runs inside a
 * savepoint, so an expected error doesn't abort the surrounding test transaction.
 */
export async function failure(
  db: PGlite,
  sql: string,
  params: unknown[] = [],
): Promise<{ code?: string | undefined; message?: string | undefined }> {
  await db.exec("savepoint expect_failure");
  try {
    await db.query(sql, params);
    await db.exec("release savepoint expect_failure");
    return {};
  } catch (e) {
    await db.exec("rollback to savepoint expect_failure");
    const { code, message } = e as { code?: string; message?: string };
    return { code, message };
  }
}
