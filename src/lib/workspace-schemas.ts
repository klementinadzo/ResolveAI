import { z } from "zod";
import { currentUser } from "@/domain/current-user";

// Input rules for every write. Server functions validate with these before
// touching the database; the database re-checks lengths and allowed values.

export const FOLLOW_UP_TYPES = [
  "Customer check-in",
  "Escalate to Customer Success Lead",
  "Executive outreach",
  "Recovery plan",
] as const;
export const TICKET_STATUSES = ["Open", "Escalated", "Resolved"] as const;
export const RISK_LEVELS = ["High", "Medium", "Low"] as const;

export const REPLY_MAX = 5000;
export const RESOLUTION_NOTE_MAX = 1000;
export const FOLLOW_UP_REASON_MAX = 500;

const ticketId = z.string().regex(/^[0-9]{1,10}$/, "Invalid ticket id");
const accountId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/, "Invalid account id");
const recordId = z.string().regex(/^[A-Za-z0-9-]{1,64}$/, "Invalid id");

export const ticketStatusInput = z
  .object({
    ticketId,
    status: z.enum(TICKET_STATUSES),
    note: z.string().trim().max(RESOLUTION_NOTE_MAX).optional(),
  })
  .refine((v) => v.status !== "Resolved" || (v.note ?? "").length > 0, {
    message: "A resolution note is required to resolve a ticket.",
    path: ["note"],
  });

export const saveDraftInput = z.object({
  ticketId,
  draft: z.string().max(REPLY_MAX),
  revision: z.number().int().min(0),
});

export const submitReplyInput = z.object({
  ticketId,
  messageId: z.uuid(),
  body: z.string().trim().min(1, "Write a reply before submitting.").max(REPLY_MAX),
});

export const createFollowUpInput = z.object({
  id: z.uuid(),
  accountId,
  type: z.enum(FOLLOW_UP_TYPES),
  reason: z.string().trim().min(1, "Add a reason.").max(FOLLOW_UP_REASON_MAX),
  owner: z.literal(currentUser().id),
  due: z.iso
    .date()
    .refine((d) => d >= "2020-01-01" && d <= "2100-12-31", "Due date is out of range."),
});

export const completeFollowUpInput = z.object({ id: recordId });

export const setRiskInput = z.object({ accountId, risk: z.enum(RISK_LEVELS) });

/** prefillDraft=false: don't put the suggested reply into an empty draft (used right after a reply is recorded). */
export const generateInsightInput = z.object({ ticketId, prefillDraft: z.boolean().optional() });

/** Turns a thrown error (including zod's JSON issue lists) into a short message for a toast. */
export function errorText(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (message.trimStart().startsWith("[")) {
    try {
      const issues = JSON.parse(message) as { message?: string }[];
      if (issues[0]?.message) return issues[0].message;
    } catch {
      /* fall through */
    }
    return "Some details were invalid.";
  }
  return message || "Something went wrong. Please try again.";
}
