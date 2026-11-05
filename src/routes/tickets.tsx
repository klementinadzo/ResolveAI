import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell, PriorityBadge, TicketStatus } from "@/components/AppShell";
import { compareTickets } from "@/lib/ticket-order";
import type { Ticket } from "@/domain/types";
import { fmtDate } from "@/lib/dates";
import { useWorkspaceData } from "@/lib/workspace/hooks";

export const Route = createFileRoute("/tickets")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Tickets — ResolveAI Customer Success Console" },
      {
        name: "description",
        content: "All customer tickets across your accounts with status and priority.",
      },
      { property: "og:title", content: "Tickets — ResolveAI Customer Success Console" },
      {
        property: "og:description",
        content: "Search, filter and work tickets in their account context.",
      },
    ],
  }),
  component: TicketsPage,
});

function TicketsPage() {
  const { tickets, accounts } = useWorkspaceData();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("Unresolved");
  const [priority, setPriority] = useState("All");
  const [sort, setSort] = useState("priority");
  const name = (id: string) => accounts.find((a) => a.id === id)!.name;

  const rows = tickets
    .filter(
      (t) =>
        status === "All" ||
        (status === "Unresolved" ? t.status !== "Resolved" : t.status === status),
    )
    .filter((t) => priority === "All" || t.priority === priority)
    .filter((t) =>
      `${t.id} ${t.title} ${name(t.accountId)}`.toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "newest"
        ? b.opened.localeCompare(a.opened)
        : sort === "account"
          ? name(a.accountId).localeCompare(name(b.accountId))
          : compareTickets(a, b),
    );

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px]">
        <h1 className="text-2xl font-semibold">Tickets</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tickets or accounts"
              className="chip w-full py-2 pl-9 pr-3 text-sm outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="chip px-3 py-2 text-sm outline-none"
          >
            {["Unresolved", "Open", "Escalated", "Resolved", "All"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="chip px-3 py-2 text-sm outline-none"
          >
            {["All", "High", "Medium", "Low"].map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All priorities" : s}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="chip px-3 py-2 text-sm outline-none"
          >
            <option value="priority">Sort: Priority</option>
            <option value="newest">Sort: Newest</option>
            <option value="account">Sort: Account</option>
          </select>
          <span className="ml-auto text-xs text-muted-foreground">
            {rows.length} of {tickets.length} tickets
          </span>
        </div>
        <div className="mt-4 space-y-3 md:hidden">
          {rows.map((t) => (
            <article key={t.id} className="glass min-w-0 p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  #{t.id} · <TicketStatus ticket={t} />
                </span>
                <PriorityBadge priority={t.priority} />
              </div>
              <h2 className="mt-2 break-words text-sm font-semibold">{t.title}</h2>
              <p className="mt-1 text-xs text-secondary-foreground">
                {name(t.accountId)} · Opened {fmtDate(t.opened)}
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/accounts/$id" params={{ id: t.accountId }} search={{ ticket: t.id }}>
                  Open ticket
                </Link>
              </Button>
            </article>
          ))}
          {rows.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No tickets match.</p>
          )}
        </div>
        <div className="glass mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Ticket", "Subject", "Account", "Status", "Priority", "Opened"].map((h) => (
                  <th key={h} className="eyebrow px-4 py-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.id}
                  onClick={() =>
                    navigate({
                      to: "/accounts/$id",
                      params: { id: t.accountId },
                      search: { ticket: t.id },
                    })
                  }
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-glass-strong"
                >
                  <td className="px-4 py-3 text-muted-foreground">#{t.id}</td>
                  <td className="px-4 py-3 font-medium">{t.title}</td>
                  <td className="px-4 py-3 text-secondary-foreground">{name(t.accountId)}</td>
                  <td className="px-4 py-3">
                    <TicketStatus ticket={t} />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3 text-secondary-foreground">{fmtDate(t.opened)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
