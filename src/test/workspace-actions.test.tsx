import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceData } from "@/domain/types";

/* ---------- In-memory stand-in for the server functions ----------
 * Mirrors the rules of the database functions in 0002_workspace_actions.sql so
 * the browser-side flows can be tested without a database. Plain functions
 * (not vi.fn) so expected rejections are not reported as unhandled. */
let db: WorkspaceData;
let calls: { fn: string; data?: unknown }[];
let loads: number;
let saveGate: Promise<void> | null; // when set, draft saves wait for it (simulates a slow network)
let failReply: boolean;
let failAi: boolean;
const toasts: string[] = [];

const ticket = (id: string) => db.tickets.find((t) => t.id === id)!;
const server = {
  getWorkspaceData: async () => {
    loads++;
    return structuredClone(db);
  },
  setTicketStatusFn: async ({
    data,
  }: {
    data: { ticketId: string; status: string; note?: string };
  }) => {
    calls.push({ fn: "status", data });
    if (data.status === "Resolved" && !data.note)
      throw new Error("Add a resolution note before resolving the ticket.");
    Object.assign(ticket(data.ticketId), {
      status: data.status,
      resolutionNote:
        data.status === "Resolved"
          ? data.note
          : data.status === "Open"
            ? null
            : ticket(data.ticketId).resolutionNote,
    });
  },
  saveDraftFn: async ({
    data,
  }: {
    data: { ticketId: string; draft: string; revision: number };
  }) => {
    calls.push({ fn: "saveDraft", data });
    if (saveGate) await saveGate;
    const t = ticket(data.ticketId);
    if (t.draftRevision !== data.revision) return { saved: false };
    t.draft = data.draft;
    return { saved: true };
  },
  submitReplyFn: async ({
    data,
  }: {
    data: { ticketId: string; messageId: string; body: string };
  }) => {
    calls.push({ fn: "submitReply", data });
    if (failReply) throw new Error("The change could not be saved. Please try again.");
    const t = ticket(data.ticketId);
    t.messages.push({ who: "Mara Okafor", customer: false, text: data.body });
    t.draft = "";
    t.draftRevision += 1;
    return { revision: t.draftRevision };
  },
  createFollowUpFn: async ({
    data,
  }: {
    data: {
      id: string;
      accountId: string;
      type: string;
      reason: string;
      owner: string;
      due: string;
    };
  }) => {
    calls.push({ fn: "createFollowUp", data });
    db.followUps.unshift({
      id: data.id,
      accountId: data.accountId,
      type: data.type as never,
      reason: data.reason,
      owner: data.owner,
      due: data.due,
      status: "Open",
    });
  },
  completeFollowUpFn: async ({ data }: { data: { id: string } }) => {
    calls.push({ fn: "completeFollowUp", data });
    db.followUps.find((f) => f.id === data.id)!.status = "Done";
  },
  generateInsightFn: async ({ data }: { data: { ticketId: string; prefillDraft?: boolean } }) => {
    calls.push({ fn: "insight", data });
    if (failAi) throw new Error("Gemini is overloaded right now. Try Refresh in a minute.");
    const t = ticket(data.ticketId);
    const reply = "Hi Priya,\n\nWe're on it and will update you by [time].\n\nBest regards,\nMara";
    t.insight = {
      summaryPoints: ["Issue: reporting sync failed again", "Account: renewal in 42 days"],
      nextSteps: ["Escalate to the integrations team", "Confirm the fix with Priya"],
      reply,
      model: "test-model",
      generatedAt: "2026-10-31T10:00:00+00:00",
      messageCount: t.messages.length,
    };
    const prefilled =
      data.prefillDraft !== false && t.draft.trim() === "" && t.status !== "Resolved";
    if (prefilled) t.draft = reply;
    return { prefilled };
  },
  setRiskFn: async ({ data }: { data: { accountId: string; risk: "High" | "Medium" | "Low" } }) => {
    calls.push({ fn: "setRisk", data });
    db.accounts.find((a) => a.id === data.accountId)!.risk = data.risk;
  },
};
vi.mock("@/lib/workspace.functions", () => server);
vi.mock("sonner", () => {
  const push = (kind: string) => (m: string, _opts?: unknown) => void toasts.push(`${kind}: ${m}`);
  return {
    toast: Object.assign(push("info"), {
      success: push("success"),
      error: push("error"),
      warning: push("warning"),
    }),
  };
});

const { WorkspaceProvider } = await import("@/lib/workspace/provider");
const { useRanked, useWorkspaceActions, useWorkspaceData } = await import("@/lib/workspace/hooks");

function seed(): WorkspaceData {
  return {
    accounts: [
      {
        id: "northstar",
        name: "Northstar Logistics",
        initials: "NL",
        owner: "You",
        tier: "Enterprise",
        users: 640,
        arr: 184000,
        renewal: "2026-11-17",
        sentiment: "Declining",
        risk: "High",
        contact: "Priya Nair",
        summary: "",
      },
    ],
    tickets: [
      {
        id: "4812",
        accountId: "northstar",
        title: "Reporting dashboard not syncing",
        category: "Integration",
        priority: "High",
        status: "Open",
        reopened: false,
        opened: "2026-10-05",
        summary: "",
        draft: "Hi Priya",
        knowledge: [],
        messages: [{ who: "Priya Nair", customer: true, text: "Help" }],
        draftRevision: 0,
        resolutionNote: null,
        insight: null,
      },
    ],
    followUps: [],
    events: [],
  };
}

type Api = ReturnType<typeof useWorkspaceData> &
  ReturnType<typeof useWorkspaceActions> & { ranked: ReturnType<typeof useRanked> };
let api: Api;
function Grab() {
  api = { ...useWorkspaceData(), ...useWorkspaceActions(), ranked: useRanked() };
  return null;
}

const DELAY = 30;
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <WorkspaceProvider draftSaveDelayMs={DELAY}>
        <Grab />
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(api).toBeDefined());
}
const settle = () => act(() => new Promise((r) => setTimeout(r, DELAY * 4)));
const t4812 = () => api.tickets.find((t) => t.id === "4812")!;

beforeEach(() => {
  db = seed();
  calls = [];
  loads = 0;
  saveGate = null;
  failReply = false;
  failAi = false;
  toasts.length = 0;
  api = undefined as unknown as Api;
});

describe("saving user actions", () => {
  it("saves a draft once, with the latest text, after typing pauses", async () => {
    await mount();
    act(() => {
      api.setDraft("4812", "Hi P");
      api.setDraft("4812", "Hi Pri");
      api.setDraft("4812", "Hi Priya, update");
    });
    await settle();
    expect(calls.filter((c) => c.fn === "saveDraft")).toEqual([
      { fn: "saveDraft", data: { ticketId: "4812", draft: "Hi Priya, update", revision: 0 } },
    ]);
    expect(db.tickets[0]!.draft).toBe("Hi Priya, update");
  });

  it("records a simulated reply and clears the draft; a pending draft save is cancelled", async () => {
    await mount();
    act(() => {
      api.setDraft("4812", "We fixed the token.");
      api.sendReply("4812");
    });
    await settle();
    expect(calls.some((c) => c.fn === "saveDraft")).toBe(false);
    expect(calls).toContainEqual(
      expect.objectContaining({
        fn: "submitReply",
        data: expect.objectContaining({ ticketId: "4812", body: "We fixed the token." }),
      }),
    );
    expect(db.tickets[0]!.draft).toBe("");
    expect(t4812().draft).toBe("");
    expect(t4812().messages.at(-1)).toEqual({
      who: "Mara Okafor",
      customer: false,
      text: "We fixed the token.",
    });
    expect(t4812().status).toBe("Open"); // no Pending status
  });

  it("ignores a slow draft save that arrives after the reply was submitted", async () => {
    await mount();
    let release!: () => void;
    saveGate = new Promise((r) => {
      release = r;
    });
    act(() => api.setDraft("4812", "Old words"));
    await settle(); // the save request is now in flight, carrying revision 0
    expect(calls.filter((c) => c.fn === "saveDraft")).toHaveLength(1);
    act(() => api.sendReply("4812"));
    await settle(); // reply recorded: draft cleared, revision now 1
    await act(async () => {
      release();
    });
    await settle();
    expect(db.tickets[0]!.draft).toBe(""); // the late save did not restore the draft
    expect(t4812().draft).toBe("");
    expect(toasts.filter((m) => m.startsWith("warning"))).toEqual([]);
  });

  it("keeps the unsent text when recording a reply fails", async () => {
    failReply = true;
    await mount();
    act(() => api.sendReply("4812"));
    await settle();
    expect(toasts).toContain("error: The change could not be saved. Please try again.");
    expect(t4812().draft).toBe("Hi Priya");
    expect(t4812().messages).toHaveLength(1);
  });

  it("creates and completes a follow-up, saving both", async () => {
    await mount();
    act(() =>
      api.createFollowUp({
        accountId: "northstar",
        type: "Recovery plan",
        reason: "Agree plan",
        owner: "You",
        due: "2026-10-01",
      }),
    );
    await settle();
    expect(db.followUps).toHaveLength(1);
    const id = db.followUps[0]!.id;
    expect(api.followUps.map((f) => f.id)).toEqual([id]);
    act(() => api.completeFollowUp(id));
    await settle();
    expect(db.followUps[0]!.status).toBe("Done");
  });

  it("saves a manual risk change", async () => {
    await mount();
    act(() => api.setRisk("northstar", "Medium"));
    await settle();
    expect(db.accounts[0]!.risk).toBe("Medium");
  });
});

describe("business rules", () => {
  it("refuses to resolve without a resolution note", async () => {
    await mount();
    act(() => api.setTicketStatus("4812", "Resolved", "   "));
    await settle();
    expect(calls.some((c) => c.fn === "status")).toBe(false);
    expect(t4812().status).toBe("Open");
    expect(toasts).toContain("error: Add a resolution note before resolving the ticket.");
  });

  it("resolving a ticket saves the note, lowers the ranking, and leaves account risk unchanged", async () => {
    await mount();
    const before = api.ranked[0]!.p.score;
    act(() => api.setTicketStatus("4812", "Resolved", "Refreshed the TMS token."));
    await settle();
    expect(db.tickets[0]).toMatchObject({
      status: "Resolved",
      resolutionNote: "Refreshed the TMS token.",
    });
    expect(api.accounts[0]!.risk).toBe("High");
    expect(db.accounts[0]!.risk).toBe("High");
    expect(api.ranked[0]!.p.score).toBeLessThan(before);
    expect(api.ranked[0]!.open).toHaveLength(0);
  });

  it("a fresh load (page refresh) shows saved changes, not the starting data", async () => {
    await mount();
    act(() => api.setRisk("northstar", "Low"));
    await settle();
    api = undefined as unknown as Api;
    await mount(); // new QueryClient = like reloading the page
    expect(api.accounts[0]!.risk).toBe("Low");
  });
});

describe("AI summary, next steps and reply", () => {
  it("generates and saves the summary and next steps", async () => {
    await mount();
    let r: Awaited<ReturnType<typeof api.generateInsight>> | undefined;
    await act(async () => {
      r = await api.generateInsight("4812");
    });
    expect(r).toEqual({ ok: true, prefilled: false });
    expect(calls).toContainEqual({ fn: "insight", data: { ticketId: "4812", prefillDraft: true } });
    await waitFor(() =>
      expect(t4812().insight?.nextSteps).toEqual([
        "Escalate to the integrations team",
        "Confirm the fix with Priya",
      ]),
    );
  });

  it("pre-fills the reply only when the draft is empty", async () => {
    db.tickets[0]!.draft = "";
    await mount();
    await act(async () => {
      await api.generateInsight("4812");
    });
    await waitFor(() => expect(t4812().draft).toContain("We're on it"));

    db.tickets[0]!.draft = "My own words";
    db.tickets[0]!.insight = null;
    await act(async () => {
      await api.generateInsight("4812");
    });
    await waitFor(() => expect(t4812().insight).not.toBeNull());
    expect(t4812().draft).toBe("My own words");
  });

  it("returns the error and changes nothing when the AI fails", async () => {
    failAi = true;
    await mount();
    let r: Awaited<ReturnType<typeof api.generateInsight>> | undefined;
    await act(async () => {
      r = await api.generateInsight("4812");
    });
    expect(r).toEqual({
      ok: false,
      error: "Gemini is overloaded right now. Try Refresh in a minute.",
    });
    expect(t4812().insight).toBeNull();
    expect(t4812().draft).toBe("Hi Priya");
  });

  it("'Use AI reply' puts the reply in the draft and saves it, with Undo", async () => {
    await mount();
    await act(async () => {
      await api.generateInsight("4812");
    });
    await waitFor(() => expect(t4812().insight).not.toBeNull());
    act(() => api.applyAiReply("4812"));
    await waitFor(() => expect(t4812().draft).toContain("We're on it"));
    await settle();
    expect(db.tickets[0]!.draft).toContain("We're on it");
    expect(toasts).toContain("success: AI reply placed in the draft. Review it before sending.");
  });
});

describe("after recording a reply", () => {
  it("refreshes the AI summary automatically, without filling the draft", async () => {
    await mount();
    await act(async () => {
      await api.generateInsight("4812"); // an existing summary
    });
    await waitFor(() => expect(t4812().insight).not.toBeNull());
    calls.length = 0;
    act(() => api.setDraft("4812", "We fixed the token."));
    act(() => api.sendReply("4812"));
    await waitFor(() => expect(calls.some((c) => c.fn === "insight")).toBe(true));
    await settle();
    expect(calls).toContainEqual({
      fn: "insight",
      data: { ticketId: "4812", prefillDraft: false },
    });
    expect(t4812().insight?.messageCount).toBe(t4812().messages.length); // no longer out of date
    expect(t4812().draft).toBe(""); // the new suggestion was not put into the draft
  });
});

describe("workspace actions", () => {
  it("keep the same identity across re-renders, so effects can depend on them", async () => {
    await mount();
    const first = api.setDraft;
    const firstGenerate = api.generateInsight;
    act(() => api.setDraft("4812", "typing…"));
    await waitFor(() => expect(t4812().draft).toBe("typing…"));
    expect(api.setDraft).toBe(first);
    expect(api.generateInsight).toBe(firstGenerate);
  });

  it("allow the automatic AI briefing only once per ticket, per workspace", async () => {
    await mount();
    expect(api.claimAutoInsight("4812")).toBe(true);
    expect(api.claimAutoInsight("4812")).toBe(false);
    api = undefined as unknown as Api;
    await mount(); // a new workspace (like reloading the page) starts fresh
    expect(api.claimAutoInsight("4812")).toBe(true);
  });
});
