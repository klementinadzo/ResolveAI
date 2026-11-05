import type { Ticket } from "@/domain/types";

const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 } as const;

/**
 * Default order of the Tickets list: unresolved before resolved; then by priority
 * (High, Medium, Low); within a priority, escalated first, then reopened, then the
 * rest; newest first as the tie-breaker.
 * e.g. High escalated → High → Medium reopened → Medium open → Low …
 */
export function compareTickets(a: Ticket, b: Ticket): number {
  const key = (t: Ticket) => [
    t.status === "Resolved" ? 1 : 0,
    PRIORITY_RANK[t.priority],
    t.status === "Escalated" ? 0 : 1,
    t.reopened ? 0 : 1,
  ];
  const ka = key(a);
  const kb = key(b);
  for (let i = 0; i < ka.length; i++) {
    const d = ka[i]! - kb[i]!;
    if (d !== 0) return d;
  }
  return b.opened.localeCompare(a.opened);
}
