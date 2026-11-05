import { daysUntil } from "@/lib/dates";
import type { Account, FollowUp, Ticket } from "./types";

// Account ranking: computed from saved data on every render, never stored.

export type Priorisation = {
  score: number;
  reasons: { text: string; hot: boolean }[];
  next: string;
  needsAttention: boolean;
};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export function prioritise(a: Account, tickets: Ticket[], followUps: FollowUp[]): Priorisation {
  const open = tickets.filter((x) => x.accountId === a.id && x.status !== "Resolved");
  const high = open.filter((x) => x.priority === "High");
  const esc = open.filter((x) => x.status === "Escalated");
  const reopened = open.filter((x) => x.reopened);
  const fus = followUps.filter((f) => f.accountId === a.id && f.status === "Open");
  const overdue = fus.filter((f) => daysUntil(f.due) < 0);
  const renewIn = daysUntil(a.renewal);
  const reasons: Priorisation["reasons"] = [];
  let score = 0;
  if (high.length) {
    score += 18 * high.length;
    reasons.push({ text: `${plural(high.length, "unresolved high-severity ticket")}`, hot: true });
  }
  if (esc.length) {
    score += 8 * esc.length;
    reasons.push({ text: plural(esc.length, "escalated ticket"), hot: true });
  }
  if (reopened.length) {
    score += 10 * reopened.length;
    reasons.push({
      text: `${plural(reopened.length, "repeated problem")} (reopened)`,
      hot: reopened.length > 1,
    });
  }
  if (overdue.length) {
    score += 15 * overdue.length;
    reasons.push({ text: plural(overdue.length, "overdue follow-up"), hot: true });
  }
  if (renewIn <= 90) {
    score += Math.max(0, Math.round((90 - renewIn) / 3));
    reasons.push({ text: `Renewal in ${renewIn} days`, hot: renewIn <= 45 });
  }
  if (a.users >= 500) {
    score += 8;
    reasons.push({ text: `High customer impact · ${a.users} users`, hot: false });
  }
  if (a.sentiment === "Declining") {
    score += 8;
    reasons.push({ text: "Sentiment declining", hot: false });
  }
  score += a.risk === "High" ? 10 : a.risk === "Medium" ? 5 : 0;

  let next = "Monitor — no action needed";
  if (overdue.length) next = `Complete overdue ${overdue[0]!.type.toLowerCase()}`;
  else if (high.length) next = `Resolve #${high[0]!.id} · ${high[0]!.title}`;
  else if (reopened.length) next = `Confirm fix for reopened #${reopened[0]!.id}`;
  else if (!fus.length && score >= 30) next = "Schedule a customer check-in";
  // Needs attention: a high overall score, or any urgent ticket (High priority or escalated), whatever the score.
  return { score, reasons, next, needsAttention: score >= 40 || high.length > 0 || esc.length > 0 };
}

export type RankedAccount = { account: Account; p: Priorisation; open: Ticket[] };

const RISK_RANK = { High: 0, Medium: 1, Low: 2 } as const;

/** Priority order: risk level first (High, Medium, Low), then highest score within a level. */
export function compareRanked(x: RankedAccount, y: RankedAccount): number {
  return RISK_RANK[x.account.risk] - RISK_RANK[y.account.risk] || y.p.score - x.p.score;
}

/** Accounts with their priorisation, in priority order (see compareRanked). */
export function rankAccounts(
  accounts: Account[],
  tickets: Ticket[],
  followUps: FollowUp[],
): RankedAccount[] {
  return accounts
    .map((a) => ({
      account: a,
      p: prioritise(a, tickets, followUps),
      open: tickets.filter((x) => x.accountId === a.id && x.status !== "Resolved"),
    }))
    .sort(compareRanked);
}
