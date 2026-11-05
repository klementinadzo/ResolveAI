import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Building2, Ticket, ListChecks } from "lucide-react";
import type { ReactNode } from "react";
import { currentUser } from "@/domain/current-user";
import { daysUntil } from "@/lib/dates";
import { useRanked, useWorkspaceData } from "@/lib/workspace/hooks";

export function AppShell({ children, flush }: { children: ReactNode; flush?: boolean }) {
  const { tickets, followUps } = useWorkspaceData();
  const me = currentUser();
  const ranked = useRanked();
  const nav = [
    {
      to: "/",
      label: "Overview",
      icon: LayoutDashboard,
      count: ranked.filter((r) => r.p.needsAttention && r.account.risk === "High").length, // same as the Overview list
      hot: true,
    },
    { to: "/accounts", label: "Accounts", icon: Building2, count: ranked.length },
    {
      to: "/tickets",
      label: "Tickets",
      icon: Ticket,
      count: tickets.filter((t) => t.status !== "Resolved").length,
    },
    {
      to: "/actions",
      label: "Actions",
      icon: ListChecks,
      count: followUps.filter((f) => f.status === "Open" && daysUntil(f.due) < 0).length,
      hot: true,
    },
  ] as const;

  return (
    <div className="app-bg relative min-h-screen w-full overflow-hidden text-foreground">
      <div
        className="pointer-events-none absolute -left-24 -top-40 h-[620px] w-[620px] rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle at 30% 30%, var(--blob-1), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute right-0 top-24 h-[560px] w-[560px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle at 60% 40%, var(--blob-2), transparent 70%)" }}
      />
      <div className="relative flex h-dvh min-h-0 flex-col">
        <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 md:flex md:gap-x-6 border-b border-glass-strong bg-glass px-3 py-2 backdrop-blur-xl md:h-14 md:flex-nowrap md:px-5 md:py-0">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary font-display text-sm font-semibold text-primary-foreground">
              R
            </div>
            <div className="min-w-0 leading-tight">
              <div className="font-display text-sm font-semibold">ResolveAI</div>
              <div className="text-[11px] text-muted-foreground">Customer Success Console</div>
            </div>
          </div>
          <nav className="order-last col-span-2 -mx-1 flex min-w-0 w-full items-center gap-1 overflow-x-auto md:order-none md:mx-0 md:w-auto">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="flex shrink-0 items-center gap-2 rounded-[10px] px-3 py-1.5 text-sm text-secondary-foreground hover:bg-glass"
                activeProps={{ className: "chip font-medium !text-foreground" }}
              >
                <n.icon className="size-4 opacity-60" />
                {n.label}
                {n.count > 0 && (
                  <span
                    className={`text-[11px] ${"hot" in n ? "text-risk" : "text-muted-foreground"}`}
                  >
                    {n.count}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden leading-tight text-right sm:block">
              <div className="text-sm font-medium">{me.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {me.role} · {me.id}
              </div>
            </div>
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/25 text-[11px] font-semibold text-accent">
              {me.initials}
            </div>
          </div>
        </header>
        <div className={`min-h-0 min-w-0 flex-1 ${flush ? "" : "overflow-y-auto p-3 sm:p-6"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function RiskBadge({ level }: { level: string }) {
  const cls =
    level === "High"
      ? "bg-risk/10 text-risk"
      : level === "Medium"
        ? "bg-warn/10 text-warn"
        : "bg-primary/10 text-primary";
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${cls}`}
    >
      {level}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cls =
    status === "Escalated"
      ? "bg-risk/10 text-risk"
      : status === "Resolved" || status === "Done"
        ? "bg-primary/10 text-primary"
        : "chip text-secondary-foreground";
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${cls}`}>
      {status}
    </span>
  );
}

/** A ticket's status as text: an open ticket that was reopened reads "Reopened". */
export function TicketStatus({ ticket }: { ticket: { status: string; reopened: boolean } }) {
  const reopened = ticket.status === "Open" && ticket.reopened;
  const cls =
    ticket.status === "Escalated" || reopened
      ? "text-risk"
      : ticket.status === "Resolved"
        ? "text-primary"
        : "text-secondary-foreground";
  return (
    <span className={`whitespace-nowrap ${cls}`}>{reopened ? "Reopened" : ticket.status}</span>
  );
}

/** Prominent priority badge: High in red so urgent tickets stand out. */
export function PriorityBadge({ priority }: { priority: string }) {
  const cls =
    priority === "High"
      ? "bg-risk/10 text-risk"
      : priority === "Medium"
        ? "bg-warn/10 text-warn"
        : "chip text-secondary-foreground";
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${cls}`}
    >
      {priority}
    </span>
  );
}
