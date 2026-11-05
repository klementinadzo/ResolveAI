import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useConsoleTabs, useRanked } from "@/lib/workspace/hooks";

/** Collapsible list of all accounts, highest priority first. */
export function AccountSidebar({
  id,
  go,
}: {
  /** The account shown now. */
  id: string;
  go: (accountId: string, ticketId?: string) => void;
}) {
  const ranked = useRanked();
  const { tabs } = useConsoleTabs();
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside
      className={`hidden shrink-0 border-r lg:block border-glass-strong bg-glass backdrop-blur-xl transition-all ${collapsed ? "w-10" : "w-60"}`}
    >
      <div className="flex items-center px-2 py-2">
        {!collapsed && <span className="eyebrow px-2">Accounts by priority</span>}
        <button
          aria-label="Toggle account list"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto rounded p-1 hover:bg-glass-strong"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>
      {!collapsed && (
        <ul className="h-[calc(100%-40px)] space-y-0.5 overflow-y-auto px-2 pb-4">
          {ranked.map((r) => (
            <li key={r.account.id}>
              <button
                onClick={() =>
                  go(r.account.id, tabs.find((t) => t.accountId === r.account.id)?.active ?? "")
                }
                className={`flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm ${r.account.id === id ? "chip font-medium" : "hover:bg-glass-strong"}`}
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ${r.account.risk === "High" ? "bg-risk" : r.account.risk === "Medium" ? "bg-warn" : "bg-primary"}`}
                />
                <span className="truncate">{r.account.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
