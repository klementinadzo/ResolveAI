import type { Tables } from "./database.types";
import type { TicketInsight } from "./ai-insight";
import type {
  Account,
  FollowUp,
  Message,
  Ticket,
  TimelineEvent,
  WorkspaceData,
} from "@/domain/types";

export type TicketRow = Tables<"tickets">;

export type WorkspaceRows = {
  accounts: Tables<"accounts">[];
  tickets: TicketRow[];
  messages: Tables<"ticket_messages">[];
  followUps: Tables<"follow_ups">[];
  events: Tables<"timeline_events">[];
};

export const toAccount = (a: Tables<"accounts">): Account => ({
  id: a.id,
  name: a.name,
  initials: a.initials,
  owner: a.owner,
  tier: a.tier,
  users: a.user_count,
  arr: a.arr,
  renewal: a.renewal_date,
  sentiment: a.sentiment,
  risk: a.risk,
  contact: a.contact_name,
  summary: a.summary,
});

export const toMessage = (m: Tables<"ticket_messages">): Message => ({
  who: m.author_name,
  customer: m.from_customer,
  text: m.body,
});

/** The saved AI briefing, or null if none has been generated yet. */
export const toInsight = (t: TicketRow): TicketInsight | null =>
  t.ai_insight_at && t.ai_summary && t.ai_next_steps && t.ai_reply
    ? {
        summaryPoints: t.ai_summary
          .split("\n")
          .map((p) => p.trim())
          .filter(Boolean),
        nextSteps: t.ai_next_steps,
        reply: t.ai_reply,
        model: t.ai_insight_model ?? "",
        generatedAt: t.ai_insight_at,
        messageCount: t.ai_insight_message_count ?? 0,
      }
    : null;

export const toTicket = (t: TicketRow, messages: Message[]): Ticket => ({
  id: t.id,
  accountId: t.account_id,
  title: t.title,
  category: t.category,
  priority: t.priority,
  status: t.status === "Pending" ? "Open" : t.status, // 0007 forbids Pending; kept for type safety
  reopened: t.reopened,
  opened: t.opened_on,
  messages,
  summary: t.summary,
  draft: t.draft,
  draftRevision: t.draft_revision,
  resolutionNote: t.resolution_note,
  insight: toInsight(t),
  knowledge: t.knowledge,
});

export const toFollowUp = (f: Tables<"follow_ups">): FollowUp => ({
  id: f.id,
  accountId: f.account_id,
  type: f.type,
  reason: f.reason,
  owner: f.owner,
  due: f.due_date,
  status: f.status,
});

/** `date` carries the real timestamp; date helpers display it as a local calendar day. */
export const toEvent = (e: Tables<"timeline_events">): TimelineEvent => ({
  id: e.id,
  accountId: e.account_id,
  date: e.occurred_at,
  title: e.title,
  detail: e.detail,
  kind: e.kind,
});

/** Rows must arrive pre-sorted (messages oldest first, events newest first); order is preserved. */
export function rowsToWorkspace(rows: WorkspaceRows): WorkspaceData {
  const messagesByTicket = new Map<string, Message[]>();
  for (const m of rows.messages) {
    const list = messagesByTicket.get(m.ticket_id) ?? [];
    list.push(toMessage(m));
    messagesByTicket.set(m.ticket_id, list);
  }
  return {
    accounts: rows.accounts.map(toAccount),
    tickets: rows.tickets.map((t) => toTicket(t, messagesByTicket.get(t.id) ?? [])),
    followUps: rows.followUps.map(toFollowUp),
    events: rows.events.map(toEvent),
  };
}
