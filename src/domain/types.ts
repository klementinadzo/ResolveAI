import type { TicketInsight } from "@/lib/ai-insight";

// The app's data, in the shape the screens use. Plain types: no React, no database.

export type RiskLevel = "High" | "Medium" | "Low";
export type Priority = "High" | "Medium" | "Low";
export type TicketStatus = "Open" | "Escalated" | "Resolved";
export type FollowUpType =
  | "Customer check-in"
  | "Escalate to Customer Success Lead"
  | "Executive outreach"
  | "Recovery plan";

export type Message = { who: string; customer: boolean; text: string };

export type Account = {
  id: string;
  name: string;
  initials: string;
  owner: string;
  tier: "Enterprise" | "Growth" | "Starter";
  users: number;
  arr: number;
  renewal: string;
  sentiment: "Declining" | "Stable" | "Improving";
  risk: RiskLevel;
  contact: string;
  summary: string;
};

export type Ticket = {
  id: string;
  accountId: string;
  title: string;
  category: string;
  priority: Priority;
  status: TicketStatus;
  reopened: boolean;
  opened: string;
  messages: Message[];
  summary: string;
  draft: string;
  knowledge: string[];
  /** Bumped by the server when a reply is sent; stale draft saves are ignored. */
  draftRevision: number;
  resolutionNote: string | null;
  /** Saved AI briefing: account-aware summary, next steps and a short reply. */
  insight: TicketInsight | null;
};

export type FollowUp = {
  id: string;
  accountId: string;
  type: FollowUpType;
  reason: string;
  owner: string;
  due: string;
  status: "Open" | "Done";
};

export type TimelineEvent = {
  id: string;
  accountId: string;
  date: string;
  title: string;
  detail: string;
  kind: "ticket" | "followup" | "reply" | "risk";
};

/** Everything the screens read. */
export type WorkspaceData = {
  accounts: Account[];
  tickets: Ticket[];
  followUps: FollowUp[];
  events: TimelineEvent[];
};

/** An account open in the workspace, with its open ticket sub-tabs. */
export type ConsoleTab = { accountId: string; tickets: string[]; active: string };
