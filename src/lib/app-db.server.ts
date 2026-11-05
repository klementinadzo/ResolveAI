import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Server-only: which database the app's data lives in.
//
// On Lovable's servers, SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY always point at
// Lovable Cloud's own database. To use your own Supabase project there, set
// APP_SUPABASE_URL and APP_SUPABASE_SECRET_KEY (as Lovable secrets); they take
// priority. Locally, SUPABASE_* in .env.local point at your project.

type AdminClient = ReturnType<typeof createClient<Database>>;
let client: AdminClient | undefined;

/** True when APP_SUPABASE_* point the app at your own Supabase project. */
export const usesOwnProject = () =>
  Boolean(process.env["APP_SUPABASE_URL"] && process.env["APP_SUPABASE_SECRET_KEY"]);

/** Server-side client with full access (bypasses access rules). Never import from browser code. */
export async function appDb(): Promise<AdminClient> {
  if (client) return client;
  const own = usesOwnProject();
  const url = process.env[own ? "APP_SUPABASE_URL" : "SUPABASE_URL"];
  const key = process.env[own ? "APP_SUPABASE_SECRET_KEY" : "SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    throw new Error(
      "The database is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  client = createClient<Database>(url, key, {
    global: {
      // New Supabase keys (sb_secret_…) are not JWTs: send them only as "apikey".
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
