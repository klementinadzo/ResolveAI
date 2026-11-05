import { X } from "lucide-react";
import { useConsoleTabs, useWorkspaceData } from "@/lib/workspace/hooks";

/** Open accounts as tabs, and the open account's ticket sub-tabs. */
export function WorkspaceTabs({
  id,
  ticket,
  go,
  closeAcct,
}: {
  /** The account shown now. */
  id: string;
  /** The ticket shown now ("" for the account record). */
  ticket: string;
  go: (accountId: string, ticketId?: string) => void;
  closeAcct: (accountId: string) => void;
}) {
  const { accounts, tickets } = useWorkspaceData();
  const { tabs, closeTicketTab } = useConsoleTabs();
  const tab = tabs.find((t) => t.accountId === id);
  return (
    <>
      {/* Workspace tabs */}
      <div className="flex shrink-0 items-end gap-1 overflow-x-auto border-b border-glass-strong bg-glass/50 px-3 pt-2">
        {tabs.map((t) => {
          const a = accounts.find((x) => x.id === t.accountId)!;
          const active = t.accountId === id;
          return (
            <div
              key={t.accountId}
              className={`group flex items-center gap-2 rounded-t-[10px] px-3 py-2 text-sm ${active ? "bg-glass-strong font-medium" : "text-secondary-foreground hover:bg-glass"}`}
            >
              <button onClick={() => go(t.accountId, t.active)} className="flex items-center gap-2">
                <span
                  className={`size-1.5 rounded-full ${a.risk === "High" ? "bg-risk" : a.risk === "Medium" ? "bg-warn" : "bg-primary"}`}
                />
                {a.name}
                {t.tickets.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">+{t.tickets.length}</span>
                )}
              </button>
              <button
                aria-label={`Close ${a.name}`}
                onClick={() => closeAcct(t.accountId)}
                className="opacity-50 hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      {/* Subtabs */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-border bg-glass-strong/60 px-3 py-1.5">
        <button
          onClick={() => go(id)}
          className={`rounded-[8px] px-3 py-1 text-xs ${!ticket ? "bg-primary text-primary-foreground" : "text-secondary-foreground hover:bg-glass"}`}
        >
          Account record
        </button>
        {tab?.tickets.map((tid) => {
          const tk = tickets.find((x) => x.id === tid)!;
          return (
            <div
              key={tid}
              className={`flex items-center gap-1.5 rounded-[8px] px-3 py-1 text-xs ${ticket === tid ? "bg-primary text-primary-foreground" : "text-secondary-foreground hover:bg-glass"}`}
            >
              <button onClick={() => go(id, tid)}>
                #{tid} {tk.title.slice(0, 24)}
                {tk.title.length > 24 ? "…" : ""}
              </button>
              <button
                aria-label={`Close ticket ${tid}`}
                onClick={() => {
                  closeTicketTab(id, tid);
                  if (ticket === tid) go(id);
                }}
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
