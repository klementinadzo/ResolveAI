import { useContext, useMemo } from "react";
import { rankAccounts } from "@/domain/prioritise";
import type { WorkspaceData } from "@/domain/types";
import type { WorkspaceActions } from "./actions";
import {
  WorkspaceActionsContext,
  WorkspaceDataContext,
  WorkspaceUiContext,
  type WorkspaceUi,
} from "./context";

function required<T>(value: T | null, hook: string): T {
  if (!value) throw new Error(`${hook} must be used inside <WorkspaceProvider>`);
  return value;
}

/** Saved accounts, tickets, follow-ups and timeline events. */
export function useWorkspaceData(): WorkspaceData {
  return required(useContext(WorkspaceDataContext), "useWorkspaceData");
}

function useUi(): WorkspaceUi {
  return required(useContext(WorkspaceUiContext), "useWorkspace hooks");
}

/** Every action. The functions never change identity, so they are safe in effect dependencies. */
export function useWorkspaceActions(): WorkspaceActions {
  return required(useContext(WorkspaceActionsContext), "useWorkspaceActions");
}

/** Accounts with their priorisation, in priority order (risk level, then score). */
export function useRanked() {
  const { accounts, tickets, followUps } = useWorkspaceData();
  return useMemo(() => rankAccounts(accounts, tickets, followUps), [accounts, tickets, followUps]);
}

/** Open account tabs and their ticket sub-tabs. */
export function useConsoleTabs() {
  const { tabs } = useUi();
  const { openRecord, closeAccountTab, closeTicketTab } = useWorkspaceActions();
  return { tabs, openRecord, closeAccountTab, closeTicketTab };
}

export function useTicketActions() {
  const { setDraft, sendReply, setTicketStatus, applyAiReply } = useWorkspaceActions();
  return { setDraft, sendReply, setTicketStatus, applyAiReply };
}

/** AI briefing actions, and whether a ticket's briefing is being generated right now. */
export function useInsights() {
  const { refreshingInsights } = useUi();
  const { generateInsight, claimAutoInsight } = useWorkspaceActions();
  return { refreshingInsights, generateInsight, claimAutoInsight };
}

export function useFollowUpActions() {
  const { createFollowUp, completeFollowUp } = useWorkspaceActions();
  return { createFollowUp, completeFollowUp };
}

export function useAccountActions() {
  const { setRisk } = useWorkspaceActions();
  return { setRisk };
}
