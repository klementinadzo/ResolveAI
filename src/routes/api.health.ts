import { createFileRoute } from "@tanstack/react-router";

// GET /api/health — reports only whether server configuration is present
// (true/false, never values) and whether the database answers.
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const configured = {
          SUPABASE_URL: Boolean(process.env["SUPABASE_URL"]),
          SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]),
          APP_SUPABASE_URL: Boolean(process.env["APP_SUPABASE_URL"]),
          APP_SUPABASE_SECRET_KEY: Boolean(process.env["APP_SUPABASE_SECRET_KEY"]),
          LOVABLE_API_KEY: Boolean(process.env["LOVABLE_API_KEY"]),
          AI_API_KEY: Boolean(process.env["AI_API_KEY"]),
        };
        const { appDb, usesOwnProject } = await import("@/lib/app-db.server");
        const target = usesOwnProject()
          ? "own Supabase project (APP_SUPABASE_*)"
          : "default (SUPABASE_*)";
        let database: { ok: boolean; target: string; accounts?: number; error?: string } = {
          ok: false,
          target,
          error: "not configured",
        };
        if (usesOwnProject() || (configured.SUPABASE_URL && configured.SUPABASE_SERVICE_ROLE_KEY)) {
          const db = await appDb();
          const { count, error } = await db
            .from("accounts")
            .select("id", { count: "exact", head: true });
          database = error
            ? { ok: false, target, error: error.message }
            : { ok: true, target, accounts: count ?? 0 };
        }
        return Response.json(
          { configured, database },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
