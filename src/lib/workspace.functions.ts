import { createServerFn } from "@tanstack/react-start";
import { currentUser } from "@/domain/current-user";
import { AI_DAILY_LIMIT, AI_INSIGHT_COOLDOWN_SECONDS } from "./ai-insight";
import type { Database, FunctionName } from "./database.types";
import { daysUntil } from "./dates";
import { rowsToWorkspace } from "./workspace-mappers";
import {
  completeFollowUpInput,
  createFollowUpInput,
  saveDraftInput,
  setRiskInput,
  submitReplyInput,
  ticketStatusInput,
  generateInsightInput,
} from "./workspace-schemas";

// Server functions run only on the server. The service-role client is loaded
// inside each handler (never at the top level) so it stays out of the browser bundle.
// Inputs are validated by the schemas above before anything reaches the database.
async function admin() {
  const { appDb } = await import("./app-db.server");
  return appDb();
}

function must<T>(label: string, res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Could not load ${label}: ${res.error.message}`);
  return res.data ?? ([] as T);
}

/** Reads the whole shared demo workspace. */
export const getWorkspaceData = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const [accounts, tickets, messages, followUps, events] = await Promise.all([
    db.from("accounts").select("*").order("name"),
    db
      .from("tickets")
      .select("*")
      .order("opened_on", { ascending: false })
      .order("id", { ascending: false }),
    db.from("ticket_messages").select("*").order("sent_at").order("id"),
    db.from("follow_ups").select("*").order("created_at", { ascending: false }).order("id"),
    db
      .from("timeline_events")
      .select("*")
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id"),
  ]);
  return rowsToWorkspace({
    accounts: must("accounts", accounts),
    tickets: must("tickets", tickets),
    messages: must("ticket messages", messages),
    followUps: must("follow-ups", followUps),
    events: must("timeline events", events),
  });
});

/* ---------- Writes ---------- */

// Database functions raise these codes; anything else becomes a generic message.
const FRIENDLY: Record<string, string> = {
  ticket_not_found: "That ticket no longer exists.",
  account_not_found: "That account no longer exists.",
  follow_up_not_found: "That follow-up no longer exists.",
  resolution_note_required: "Add a resolution note before resolving the ticket.",
  reply_empty: "Write a reply before submitting.",
  ticket_resolved: "This ticket is resolved. Reopen it before replying.",
  ai_daily_limit: `The daily AI limit (${AI_DAILY_LIMIT} requests) is reached. Try again tomorrow.`,
  ai_ticket_cooldown:
    "This ticket's AI summary was just refreshed. Wait a moment before trying again.",
};

type Fns = Database["public"]["Functions"];

/** Calls a database function; arguments and result are typed from the schema. */
async function run<F extends FunctionName>(
  fn: F,
  args: Fns[F]["Args"],
): Promise<Fns[F]["Returns"]> {
  const db = await admin();
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    // Our database functions `raise exception '<key>'`, which Postgres reports as
    // SQLSTATE P0001 with the key as the whole message.
    const key =
      error.code === "P0001" && Object.hasOwn(FRIENDLY, error.message) ? error.message : null;
    if (!key) console.error(`[${fn}]`, error.code, error.message);
    throw new Error(key ? FRIENDLY[key] : "The change could not be saved. Please try again.");
  }
  return data;
}

export const setTicketStatusFn = createServerFn({ method: "POST" })
  .validator(ticketStatusInput)
  .handler(async ({ data }) => {
    await run("set_ticket_status", {
      p_ticket_id: data.ticketId,
      p_status: data.status,
      p_note: data.note ?? "", // the function treats an empty note as none
    });
  });

/** Returns saved=false when a reply was submitted since this draft was loaded. */
export const saveDraftFn = createServerFn({ method: "POST" })
  .validator(saveDraftInput)
  .handler(async ({ data }) => {
    const saved = await run("save_ticket_draft", {
      p_ticket_id: data.ticketId,
      p_draft: data.draft,
      p_revision: data.revision,
    });
    return { saved: saved === true };
  });

/** Records a simulated reply (no email is sent). Returns the ticket's new draft revision. */
export const submitReplyFn = createServerFn({ method: "POST" })
  .validator(submitReplyInput)
  .handler(async ({ data }) => {
    const revision = await run("submit_simulated_reply", {
      p_ticket_id: data.ticketId,
      p_message_id: data.messageId,
      p_body: data.body,
      p_author: currentUser().name,
    });
    return { revision: Number(revision) };
  });

export const createFollowUpFn = createServerFn({ method: "POST" })
  .validator(createFollowUpInput)
  .handler(async ({ data }) => {
    await run("create_follow_up", {
      p_id: data.id,
      p_account_id: data.accountId,
      p_type: data.type,
      p_reason: data.reason,
      p_owner: data.owner,
      p_due: data.due,
    });
  });

export const completeFollowUpFn = createServerFn({ method: "POST" })
  .validator(completeFollowUpInput)
  .handler(async ({ data }) => {
    await run("complete_follow_up", { p_id: data.id });
  });

export const setRiskFn = createServerFn({ method: "POST" })
  .validator(setRiskInput)
  .handler(async ({ data }) => {
    await run("set_account_risk", { p_account_id: data.accountId, p_risk: data.risk });
  });

/* ---------- AI briefing (Gemini or Lovable AI) ---------- */

/**
 * Real LLM call: reads the ticket in its account context and saves an account-aware
 * summary, next steps and a short reply. The reply pre-fills the draft only if it is empty.
 * Limited by the daily cap and a per-ticket cooldown.
 */
export const generateInsightFn = createServerFn({ method: "POST" })
  .validator(generateInsightInput)
  .handler(async ({ data }) => {
    const { resolveAiProvider, insightWithGateway } = await import("./ai-gateway.server");
    const provider = resolveAiProvider(process.env);
    if (!provider) {
      throw new Error("AI isn't configured on the server (set AI_API_KEY or LOVABLE_API_KEY).");
    }

    // Reserve the call first: enforces the spending limits before anything is sent.
    const requestId = String(
      await run("begin_ai_request", {
        p_ticket_id: data.ticketId,
        p_daily_limit: AI_DAILY_LIMIT,
        p_ticket_cooldown_seconds: AI_INSIGHT_COOLDOWN_SECONDS,
      }),
    );
    const db = await admin();
    try {
      const ticket = await db
        .from("tickets")
        .select("id, account_id, title, category, priority, status, reopened, opened_on")
        .eq("id", data.ticketId)
        .single();
      if (ticket.error || !ticket.data) throw new Error(FRIENDLY["ticket_not_found"]);
      const t = ticket.data;
      const [account, messages, others, followUps, events] = await Promise.all([
        db.from("accounts").select("*").eq("id", t.account_id).single(),
        db
          .from("ticket_messages")
          .select("author_name, from_customer, body")
          .eq("ticket_id", t.id)
          .order("sent_at")
          .order("id"),
        db
          .from("tickets")
          .select("id, title, priority, status, reopened")
          .eq("account_id", t.account_id)
          .neq("id", t.id)
          .neq("status", "Resolved"),
        db
          .from("follow_ups")
          .select("type, reason, due_date")
          .eq("account_id", t.account_id)
          .eq("status", "Open")
          .order("due_date"),
        db
          .from("timeline_events")
          .select("occurred_at, title")
          .eq("account_id", t.account_id)
          .order("occurred_at", { ascending: false })
          .limit(8),
      ]);
      if (account.error || !account.data) throw new Error(FRIENDLY["account_not_found"]);
      const a = account.data;
      const conversation = must("ticket messages", messages);

      const result = await insightWithGateway(
        {
          account: {
            name: a.name,
            tier: a.tier,
            users: a.user_count,
            renewal: a.renewal_date,
            renewalInDays: daysUntil(a.renewal_date),
            sentiment: a.sentiment,
            risk: a.risk,
            owner: a.owner,
            contact: a.contact_name,
          },
          ticket: {
            id: t.id,
            title: t.title,
            category: t.category,
            priority: t.priority,
            status: t.status,
            reopened: t.reopened,
            opened: t.opened_on,
          },
          messages: conversation.map((m) => ({
            fromCustomer: m.from_customer,
            author: m.author_name,
            body: m.body,
          })),
          otherTickets: must("tickets", others),
          followUps: must("follow-ups", followUps).map((f) => ({
            type: f.type,
            reason: f.reason,
            due: f.due_date,
            overdue: daysUntil(f.due_date) < 0,
          })),
          recentEvents: must("timeline events", events).map((e) => ({
            date: e.occurred_at.slice(0, 10),
            title: e.title,
          })),
        },
        { provider },
      );
      const prefilled = await run("save_ticket_insight", {
        p_ticket_id: t.id,
        p_summary: result.summary_points.join("\n"),
        p_next_steps: result.next_steps,
        p_reply: result.reply,
        p_model: provider.model,
        p_message_count: conversation.length,
        p_prefill: data.prefillDraft ?? true,
      });
      await finishAiRequest(requestId, true, null);
      return { prefilled: prefilled === true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await finishAiRequest(requestId, false, message);
      throw e instanceof Error ? e : new Error(message);
    }
  });

/** Records how an AI request ended. */
async function finishAiRequest(id: string, succeeded: boolean, error: string | null) {
  const db = await admin();
  await db
    .from("ai_requests")
    .update({ succeeded, error: error?.slice(0, 500) ?? null })
    .eq("id", id);
}
