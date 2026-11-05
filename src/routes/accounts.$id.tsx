import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { AccountRecord } from "@/components/console/AccountRecord";
import { AccountSidebar } from "@/components/console/AccountSidebar";
import { RiskPanel } from "@/components/console/RiskPanel";
import { TicketView } from "@/components/console/TicketView";
import { WorkspaceTabs } from "@/components/console/WorkspaceTabs";
import { useConsoleTabs, useWorkspaceData } from "@/lib/workspace/hooks";

export const Route = createFileRoute("/accounts/$id")({
  validateSearch: zodValidator(z.object({ ticket: fallback(z.coerce.string(), "").default("") })),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Account workspace — ResolveAI Customer Success Console" },
      {
        name: "description",
        content:
          "Account summary, risk drivers, related tickets, timeline and follow-ups in one console workspace.",
      },
      { property: "og:title", content: "Account workspace — ResolveAI" },
      { property: "og:description", content: "Work an account and its tickets side by side." },
    ],
  }),
  component: ConsolePage,
});

function ConsolePage() {
  const { id } = Route.useParams();
  const { ticket } = Route.useSearch();
  const { accounts, tickets } = useWorkspaceData();
  const { tabs, openRecord, closeAccountTab } = useConsoleTabs();
  const navigate = useNavigate();
  const account = accounts.find((a) => a.id === id);

  // Open (or switch to) this account's tab whenever the address changes.
  const accountExists = !!account;
  useEffect(() => {
    if (accountExists) openRecord(id, ticket || undefined);
  }, [accountExists, id, ticket, openRecord]);

  if (!account)
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">
          Account not found.{" "}
          <Link to="/accounts" className="text-primary underline">
            Back to accounts
          </Link>
        </p>
      </AppShell>
    );
  const go = (accountId: string, t = "") =>
    navigate({ to: "/accounts/$id", params: { id: accountId }, search: { ticket: t } });
  const closeAcct = (accountId: string) => {
    const rest = tabs.filter((t) => t.accountId !== accountId);
    closeAccountTab(accountId);
    if (accountId !== id) return;
    // Closing the open tab: show the last remaining tab, or the Accounts list.
    const last = rest[rest.length - 1];
    if (last) go(last.accountId, last.active);
    else navigate({ to: "/accounts" });
  };

  return (
    <AppShell flush>
      <div className="flex h-full flex-col">
        <WorkspaceTabs id={id} ticket={ticket} go={go} closeAcct={closeAcct} />

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <AccountSidebar id={id} go={go} />

          <main className="min-w-0 flex-1 p-3 sm:p-5 lg:overflow-y-auto">
            {ticket && tickets.some((x) => x.id === ticket) ? (
              <TicketView key={ticket} ticketId={ticket} />
            ) : (
              <AccountRecord accountId={id} onOpenTicket={(t) => go(id, t)} />
            )}
          </main>

          <aside className="w-full shrink-0 border-t border-glass-strong bg-glass/40 p-4 lg:w-[340px] lg:overflow-y-auto lg:border-l lg:border-t-0 xl:w-[340px]">
            <RiskPanel accountId={id} onOpenTicket={(t) => go(id, t)} />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
