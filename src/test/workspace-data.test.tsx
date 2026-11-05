import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { daysUntil, fmtDate, parseIso, toIso as toIsoLocal, today } from "@/lib/dates";
import { prioritise } from "@/domain/prioritise";
import type { WorkspaceData } from "@/domain/types";
import { rowsToWorkspace, type WorkspaceRows } from "@/lib/workspace-mappers";

// The server function is replaced with a plain function (not vi.fn, whose result
// tracking reports an expected rejection as unhandled).
let loadWorkspace: () => Promise<WorkspaceData> = () => new Promise(() => {});
vi.mock("@/lib/workspace.functions", () => ({ getWorkspaceData: () => loadWorkspace() }));

const { WorkspaceProvider } = await import("@/lib/workspace/provider");
const { useRanked, useWorkspaceData } = await import("@/lib/workspace/hooks");

const stamp = { created_at: "2026-10-14T09:00:00+00:00" };
const rows: WorkspaceRows = {
  accounts: [
    {
      ...stamp,
      updated_at: stamp.created_at,
      id: "northstar",
      name: "Northstar Logistics",
      initials: "NL",
      owner: "You",
      tier: "Enterprise",
      user_count: 640,
      arr: 184000,
      renewal_date: "2026-11-17",
      sentiment: "Declining",
      risk: "High",
      contact_name: "Priya Nair",
      summary: "Freight forwarder.",
    },
  ],
  tickets: [
    {
      ...stamp,
      updated_at: stamp.created_at,
      id: "4812",
      account_id: "northstar",
      title: "Reporting dashboard not syncing",
      category: "Integration",
      priority: "High",
      status: "Open",
      reopened: false,
      opened_on: "2026-10-05",
      summary: "Recurring integration failure.",
      draft: "Hi Priya",
      knowledge: ["Refreshing TMS connector tokens"],
      draft_revision: 0,
      resolution_note: null,
      ai_summary: null,
      ai_next_steps: null,
      ai_reply: null,
      ai_insight_model: null,
      ai_insight_at: null,
      ai_insight_message_count: null,
    },
  ],
  messages: [
    {
      ...stamp,
      id: "m-4812-1",
      ticket_id: "4812",
      author_name: "Priya Nair",
      from_customer: true,
      body: "First",
      sent_at: "2026-10-05T12:00:00+00:00",
    },
    {
      ...stamp,
      id: "m-4812-2",
      ticket_id: "4812",
      author_name: "Mara Okafor",
      from_customer: false,
      body: "Second",
      sent_at: "2026-10-05T12:15:00+00:00",
    },
  ],
  followUps: [
    {
      ...stamp,
      updated_at: stamp.created_at,
      id: "f1",
      account_id: "northstar",
      type: "Recovery plan",
      reason: "Agree a plan.",
      owner: "You",
      due_date: "2026-10-02",
      status: "Open",
      completed_at: null,
    },
  ],
  events: [
    {
      ...stamp,
      id: "e-4812",
      account_id: "northstar",
      occurred_at: "2026-10-05T12:00:00+00:00",
      title: "#4812 opened",
      detail: "Opened",
      kind: "ticket",
    },
  ],
};

describe("rowsToWorkspace", () => {
  it("maps database rows to the existing UI shapes", () => {
    const d = rowsToWorkspace(rows);
    expect(d.accounts[0]).toMatchObject({
      id: "northstar",
      users: 640,
      renewal: "2026-11-17",
      contact: "Priya Nair",
      risk: "High",
    });
    expect(d.tickets[0]).toMatchObject({
      id: "4812",
      accountId: "northstar",
      opened: "2026-10-05",
      draft: "Hi Priya",
    });
    expect(d.followUps[0]).toMatchObject({
      id: "f1",
      accountId: "northstar",
      due: "2026-10-02",
      status: "Open",
    });
    expect(d.events[0]).toMatchObject({
      id: "e-4812",
      accountId: "northstar",
      date: "2026-10-05T12:00:00+00:00",
    });
  });

  it("attaches messages to their ticket in the order received", () => {
    const d = rowsToWorkspace(rows);
    expect(d.tickets[0]!.messages).toEqual([
      { who: "Priya Nair", customer: true, text: "First" },
      { who: "Mara Okafor", customer: false, text: "Second" },
    ]);
  });

  it("gives tickets without messages an empty list", () => {
    const d = rowsToWorkspace({ ...rows, messages: [] });
    expect(d.tickets[0]!.messages).toEqual([]);
  });
});

describe("date helpers", () => {
  it("counts days from the real current day, which moves with the clock", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(2026, 9, 31, 15, 30)); // 31 Oct 2026, mid-afternoon
      expect(toIsoLocal(today())).toBe("2026-10-31");
      expect(daysUntil("2026-10-31")).toBe(0);
      expect(daysUntil("2026-10-02")).toBe(-29);
      expect(daysUntil("2026-11-17")).toBe(17);
      vi.setSystemTime(new Date(2026, 10, 1, 0, 5)); // just after midnight: a new day
      expect(daysUntil("2026-11-17")).toBe(16);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reads real timestamps as a calendar day", () => {
    const d = parseIso("2026-10-05T12:00:00+00:00");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 5]);
    expect(fmtDate("2026-10-05T12:00:00+00:00")).toBe(fmtDate("2026-10-05"));
  });
});

function Probe() {
  const { accounts, tickets } = useWorkspaceData();
  const ranked = useRanked();
  return (
    <p>
      {accounts.length} accounts · {tickets[0]!.messages.length} messages · top score{" "}
      {ranked[0]!.p.score}
    </p>
  );
}

function renderProvider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
}

describe("WorkspaceProvider", () => {
  it("shows a loading message, then the saved data", async () => {
    loadWorkspace = () => Promise.resolve(rowsToWorkspace(rows));
    renderProvider();
    expect(screen.getByRole("status")).toHaveTextContent("Loading workspace");
    expect(await screen.findByText(/1 accounts · 2 messages · top score/)).toBeInTheDocument();
  });

  it("shows an error message with a retry button when loading fails", async () => {
    loadWorkspace = () =>
      Promise.reject(
        new Error("Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY"),
      );
    renderProvider();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the workspace");
    expect(screen.getByRole("alert")).toHaveTextContent("SUPABASE_SERVICE_ROLE_KEY");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("needs attention", () => {
  const account = {
    id: "vireo",
    name: "Vireo Health",
    initials: "VH",
    owner: "You",
    tier: "Growth" as const,
    users: 340,
    arr: 81000,
    renewal: "2099-01-01",
    sentiment: "Stable" as const,
    risk: "Low" as const,
    contact: "Dr. Hana Mori",
    summary: "",
  };
  const ticket = (priority: "High" | "Medium", status: "Open" | "Escalated" | "Resolved") => ({
    id: "1",
    accountId: "vireo",
    title: "t",
    category: "API",
    priority,
    status,
    reopened: false,
    opened: "2026-10-30",
    messages: [],
    summary: "",
    draft: "",
    knowledge: [],
    draftRevision: 0,
    resolutionNote: null,
    insight: null,
  });

  it("flags a low-score account that has an unresolved High or escalated ticket", () => {
    expect(prioritise(account, [ticket("High", "Open")], []).needsAttention).toBe(true);
    expect(prioritise(account, [ticket("Medium", "Escalated")], []).needsAttention).toBe(true);
  });

  it("does not flag it for Medium open or resolved tickets alone", () => {
    expect(prioritise(account, [ticket("Medium", "Open")], []).needsAttention).toBe(false);
    expect(prioritise(account, [ticket("High", "Resolved")], []).needsAttention).toBe(false);
  });
});
