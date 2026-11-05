import type { QueryClient } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { currentUser } from "@/domain/current-user";
import type {
  ConsoleTab,
  FollowUp,
  RiskLevel,
  Ticket,
  TicketStatus,
  TimelineEvent,
  WorkspaceData,
} from "@/domain/types";
import { fmtDate } from "../dates";
import {
  completeFollowUpFn,
  createFollowUpFn,
  generateInsightFn,
  saveDraftFn,
  setRiskFn,
  setTicketStatusFn,
  submitReplyFn,
} from "../workspace.functions";
import { errorText } from "../workspace-schemas";
import { workspaceQuery } from "./query";

/** Wait after the last keystroke before saving a draft. */
export const DRAFT_SAVE_DELAY_MS = 500;

export type InsightResult = { ok: true; prefilled: boolean } | { ok: false; error: string };

export type WorkspaceActions = {
  openRecord: (accountId: string, ticketId?: string) => void;
  closeAccountTab: (accountId: string) => void;
  closeTicketTab: (accountId: string, ticketId: string) => void;
  setDraft: (id: string, text: string) => void;
  sendReply: (id: string) => void;
  setTicketStatus: (id: string, s: TicketStatus, note?: string) => void;
  createFollowUp: (f: Omit<FollowUp, "id" | "status">) => void;
  completeFollowUp: (id: string) => void;
  setRisk: (accountId: string, r: RiskLevel) => void;
  /** Real LLM call on the server: saves the AI briefing (its reply fills an empty draft unless prefillDraft is false). */
  generateInsight: (id: string, opts?: { prefillDraft?: boolean }) => Promise<InsightResult>;
  /** Puts the saved AI reply in the draft (saved like typed text), with Undo. */
  applyAiReply: (id: string) => void;
  /** True the first time it is asked for a ticket in this session: used to generate a briefing automatically once. */
  claimAutoInsight: (id: string) => boolean;
  /** Stops pending draft-save timers (when the workspace unmounts). */
  dispose: () => void;
};

type Deps = {
  queryClient: QueryClient;
  setTabs: Dispatch<SetStateAction<ConsoleTab[]>>;
  setRefreshingInsights: Dispatch<SetStateAction<string[]>>;
  draftSaveDelayMs: number;
};

/**
 * Every user action, created once per workspace so their identities never change.
 * They read the latest saved data from the query cache when they run, update the
 * screen at once, save through the server, then reload the saved data.
 */
export function createWorkspaceActions(deps: Deps): WorkspaceActions {
  const { queryClient, setTabs, setRefreshingInsights, draftSaveDelayMs } = deps;
  const key = workspaceQuery.queryKey;
  const draftTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const draftSaves = new Set<Promise<void>>();
  const autoRequested = new Set<string>();
  const me = currentUser();

  const current = (): WorkspaceData | undefined => queryClient.getQueryData(key);
  const update = (fn: (d: WorkspaceData) => WorkspaceData) =>
    queryClient.setQueryData(key, (d) => (d ? fn(d) : d));
  const findTicket = (id: string) => current()?.tickets.find((x) => x.id === id);
  const patchTicket = (id: string, p: Partial<Ticket>) =>
    update((d) => ({ ...d, tickets: d.tickets.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const reload = () => queryClient.invalidateQueries({ queryKey: key });
  // Optimistic timeline entry; replaced by the saved event when data reloads.
  const log = (accountId: string, title: string, detail: string, kind: TimelineEvent["kind"]) =>
    update((d) => ({
      ...d,
      events: [
        {
          id: `local-${crypto.randomUUID()}`,
          accountId,
          date: new Date().toISOString(),
          title,
          detail,
          kind,
        },
        ...d.events,
      ],
    }));

  /* Drafts: saved automatically after a pause; sending a reply cancels any pending save. */
  const saveDraftNow = (id: string) => {
    draftTimers.delete(id);
    const t = findTicket(id);
    if (!t) return Promise.resolve();
    const save = saveDraftFn({ data: { ticketId: id, draft: t.draft, revision: t.draftRevision } })
      .then(async ({ saved }) => {
        // Ignored because a reply was sent meanwhile. Expected right after our own send (draft is empty).
        if (!saved && findTicket(id)?.draft) {
          toast.warning("A reply was submitted on this ticket, so your draft wasn't saved.");
          await reload();
        }
      })
      .catch((e: unknown) => {
        toast.error(`Draft not saved: ${errorText(e)}`);
      })
      .finally(() => {
        draftSaves.delete(save);
      });
    draftSaves.add(save);
    return save;
  };
  const scheduleDraftSave = (id: string) => {
    clearTimeout(draftTimers.get(id));
    draftTimers.set(
      id,
      setTimeout(() => void saveDraftNow(id), draftSaveDelayMs),
    );
  };
  const cancelDraftSave = (id: string) => {
    clearTimeout(draftTimers.get(id));
    draftTimers.delete(id);
  };
  /** Saves pending drafts and waits for in-flight ones, so a reload can't show an older draft. */
  const flushDrafts = async () => {
    const ids = [...draftTimers.keys()];
    ids.forEach(cancelDraftSave);
    await Promise.all([...ids.map(saveDraftNow), ...draftSaves]);
  };

  /** Saves through the server, then reloads saved data. On failure: explain, reload, then run `restore`. */
  const persist = async (save: () => Promise<unknown>, restore?: () => void): Promise<boolean> => {
    let failed = false;
    try {
      await save();
    } catch (e) {
      failed = true;
      toast.error(errorText(e));
    }
    await flushDrafts();
    await reload();
    if (failed) restore?.();
    return !failed;
  };

  /* ---------- Workspace tabs ---------- */
  const openRecord: WorkspaceActions["openRecord"] = (accountId, ticketId) =>
    setTabs((ts) => {
      const existing = ts.find((x) => x.accountId === accountId);
      const sub = ticketId ?? "";
      if (!existing) return [...ts, { accountId, tickets: sub ? [sub] : [], active: sub }];
      if (existing.active === sub && (!sub || existing.tickets.includes(sub))) return ts; // nothing changes
      return ts.map((x) =>
        x.accountId !== accountId
          ? x
          : {
              ...x,
              active: sub,
              tickets: sub && !x.tickets.includes(sub) ? [...x.tickets, sub] : x.tickets,
            },
      );
    });
  const closeAccountTab: WorkspaceActions["closeAccountTab"] = (accountId) =>
    setTabs((ts) => ts.filter((x) => x.accountId !== accountId));
  const closeTicketTab: WorkspaceActions["closeTicketTab"] = (accountId, ticketId) =>
    setTabs((ts) =>
      ts.map((x) =>
        x.accountId !== accountId
          ? x
          : {
              ...x,
              tickets: x.tickets.filter((i) => i !== ticketId),
              active: x.active === ticketId ? "" : x.active,
            },
      ),
    );

  /* ---------- Tickets ---------- */
  const setDraft: WorkspaceActions["setDraft"] = (id, text) => {
    patchTicket(id, { draft: text });
    scheduleDraftSave(id);
  };

  const generateInsight: WorkspaceActions["generateInsight"] = async (id, opts) => {
    setRefreshingInsights((ids) => [...ids, id]);
    try {
      await flushDrafts(); // the server only pre-fills an empty draft, so it must see the latest one
      const { prefilled } = await generateInsightFn({
        data: { ticketId: id, prefillDraft: opts?.prefillDraft ?? true },
      });
      return { ok: true, prefilled };
    } catch (e) {
      return { ok: false, error: errorText(e) };
    } finally {
      await flushDrafts();
      await reload();
      setRefreshingInsights((ids) => ids.filter((x) => x !== id));
    }
  };

  const sendReply: WorkspaceActions["sendReply"] = (id) => {
    const tk = findTicket(id);
    const body = tk?.draft.trim();
    if (!tk || !body) return;
    cancelDraftSave(id); // a delayed save must not bring the draft back
    const messageId = crypto.randomUUID();
    patchTicket(id, {
      messages: [...tk.messages, { who: me.name, customer: false, text: body }],
      draft: "",
    });
    log(
      tk.accountId,
      `Simulated reply recorded on #${id}`,
      body.slice(0, 90) + (body.length > 90 ? "…" : ""),
      "reply",
    );
    void persist(
      async () => {
        const { revision } = await submitReplyFn({ data: { ticketId: id, messageId, body } });
        patchTicket(id, { draftRevision: revision });
      },
      () => {
        patchTicket(id, { draft: tk.draft }); // keep the unsent text
        scheduleDraftSave(id);
      },
    ).then(async (saved) => {
      // The conversation changed, so refresh the AI briefing (one AI request). Its new
      // suggested reply is not put into the draft, so it can't be sent by accident.
      if (!saved || !findTicket(id)?.insight) return;
      const r = await generateInsight(id, { prefillDraft: false });
      if (!r.ok) toast.warning(`AI summary not refreshed: ${r.error}`);
    });
  };

  const setTicketStatus: WorkspaceActions["setTicketStatus"] = (id, s, note) => {
    const tk = findTicket(id);
    if (!tk || tk.status === s) return;
    const cleanNote = note?.trim() ?? "";
    if (s === "Resolved" && !cleanNote) {
      toast.error("Add a resolution note before resolving the ticket.");
      return;
    }
    patchTicket(id, {
      status: s,
      ...(s === "Resolved"
        ? { resolutionNote: cleanNote }
        : s === "Open"
          ? { resolutionNote: null }
          : {}),
    });
    log(
      tk.accountId,
      `#${id} ${s.toLowerCase()}`,
      s === "Escalated"
        ? "Escalated to Tier-2"
        : s === "Resolved"
          ? `Resolved by ${me.id} · Note: ${cleanNote.slice(0, 400)}`
          : `Status set to ${s}`,
      "ticket",
    );
    void persist(() =>
      setTicketStatusFn({
        data: { ticketId: id, status: s, note: s === "Resolved" ? cleanNote : undefined },
      }),
    );
  };

  const applyAiReply: WorkspaceActions["applyAiReply"] = (id) => {
    const t = findTicket(id);
    if (!t?.insight) return;
    const previous = t.draft;
    setDraft(id, t.insight.reply);
    toast.success(
      "AI reply placed in the draft. Review it before sending.",
      previous.trim()
        ? { action: { label: "Undo", onClick: () => setDraft(id, previous) } }
        : undefined,
    );
  };

  /* ---------- Follow-ups and accounts ---------- */
  const createFollowUp: WorkspaceActions["createFollowUp"] = (f) => {
    const id = crypto.randomUUID();
    update((d) => ({ ...d, followUps: [{ ...f, id, status: "Open" }, ...d.followUps] }));
    log(
      f.accountId,
      `Follow-up created: ${f.type}`,
      `${f.reason} · Owner: ${f.owner} · Due ${fmtDate(f.due)}`,
      "followup",
    );
    void persist(() =>
      createFollowUpFn({
        data: {
          id,
          accountId: f.accountId,
          type: f.type,
          reason: f.reason,
          owner: f.owner,
          due: f.due,
        },
      }),
    );
  };

  const completeFollowUp: WorkspaceActions["completeFollowUp"] = (id) => {
    const f = current()?.followUps.find((x) => x.id === id);
    if (!f || f.status === "Done") return;
    update((d) => ({
      ...d,
      followUps: d.followUps.map((y) => (y.id === id ? { ...y, status: "Done" } : y)),
    }));
    log(f.accountId, `Follow-up completed: ${f.type}`, f.reason, "followup");
    void persist(() => completeFollowUpFn({ data: { id } }));
  };

  const setRisk: WorkspaceActions["setRisk"] = (accountId, r) => {
    const a = current()?.accounts.find((x) => x.id === accountId);
    if (!a || a.risk === r) return;
    update((d) => ({
      ...d,
      accounts: d.accounts.map((x) => (x.id === accountId ? { ...x, risk: r } : x)),
    }));
    log(accountId, `Risk level set to ${r}`, `Updated manually by ${me.id} after review`, "risk");
    void persist(() => setRiskFn({ data: { accountId, risk: r } }));
  };

  const claimAutoInsight: WorkspaceActions["claimAutoInsight"] = (id) => {
    if (autoRequested.has(id)) return false;
    autoRequested.add(id);
    return true;
  };

  const dispose = () => {
    draftTimers.forEach((t) => clearTimeout(t));
    draftTimers.clear();
  };

  return {
    openRecord,
    closeAccountTab,
    closeTicketTab,
    setDraft,
    sendReply,
    setTicketStatus,
    createFollowUp,
    completeFollowUp,
    setRisk,
    generateInsight,
    applyAiReply,
    claimAutoInsight,
    dispose,
  };
}
