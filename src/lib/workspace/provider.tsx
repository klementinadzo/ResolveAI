import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ConsoleTab } from "@/domain/types";
import { createWorkspaceActions, DRAFT_SAVE_DELAY_MS } from "./actions";
import { WorkspaceActionsContext, WorkspaceDataContext, WorkspaceUiContext } from "./context";
import { workspaceQuery } from "./query";

/** Loads the shared workspace and provides its data, screen state and actions. */
export function WorkspaceProvider({
  children,
  draftSaveDelayMs = DRAFT_SAVE_DELAY_MS,
}: {
  children: ReactNode;
  draftSaveDelayMs?: number;
}) {
  const queryClient = useQueryClient();
  const query = useQuery(workspaceQuery);
  const [tabs, setTabs] = useState<ConsoleTab[]>([]);
  const [refreshingInsights, setRefreshingInsights] = useState<string[]>([]);
  // Created once (per client and delay), so every action keeps the same identity.
  const actions = useMemo(
    () => createWorkspaceActions({ queryClient, setTabs, setRefreshingInsights, draftSaveDelayMs }),
    [queryClient, draftSaveDelayMs],
  );
  useEffect(() => actions.dispose, [actions]);
  const ui = useMemo(() => ({ tabs, refreshingInsights }), [tabs, refreshingInsights]);

  if (query.isPending) return <WorkspaceStatus title="Loading workspace…" />;
  if (query.isError) {
    return (
      <WorkspaceStatus
        title="Couldn't load the workspace"
        detail={query.error.message}
        action={
          <button
            onClick={() => void query.refetch()}
            className="rounded-[10px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        }
      />
    );
  }

  return (
    <WorkspaceActionsContext.Provider value={actions}>
      <WorkspaceDataContext.Provider value={query.data}>
        <WorkspaceUiContext.Provider value={ui}>{children}</WorkspaceUiContext.Provider>
      </WorkspaceDataContext.Provider>
    </WorkspaceActionsContext.Provider>
  );
}

function WorkspaceStatus({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="app-bg grid min-h-dvh place-items-center p-4 text-foreground">
      <div role={detail ? "alert" : "status"} className="glass w-full max-w-sm p-6 text-center">
        <div className="font-display text-sm font-semibold">{title}</div>
        {detail && <p className="mt-2 break-words text-xs text-muted-foreground">{detail}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}
