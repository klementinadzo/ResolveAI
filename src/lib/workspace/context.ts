import { createContext } from "react";
import type { ConsoleTab, WorkspaceData } from "@/domain/types";
import type { WorkspaceActions } from "./actions";

// Three separate contexts, so a screen only re-renders for what it uses:
// the saved data, the workspace's screen state, and the (never-changing) actions.

export const WorkspaceDataContext = createContext<WorkspaceData | null>(null);

export type WorkspaceUi = {
  tabs: ConsoleTab[];
  /** Tickets whose AI briefing is being generated right now. */
  refreshingInsights: string[];
};
export const WorkspaceUiContext = createContext<WorkspaceUi | null>(null);

export const WorkspaceActionsContext = createContext<WorkspaceActions | null>(null);
