import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, AlertTriangle, Clock, Info } from "lucide-react";
import { AppShell, RiskBadge } from "@/components/AppShell";
import { compareTickets } from "@/lib/ticket-order";
import { currentUser } from "@/domain/current-user";
import { dayCount, daysUntil, fmtDate } from "@/lib/dates";
import { useRanked, useWorkspaceData } from "@/lib/workspace/hooks";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Overview — ResolveAI Customer Success Console" },
      {
        name: "description",
        content:
          "Prioritised accounts, overdue follow-ups and urgent tickets for Customer Success Managers.",
      },
      { property: "og:title", content: "Overview — ResolveAI Customer Success Console" },
      { property: "og:description", content: "See which accounts need attention today and why." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const ranked = useRanked();
  const { tickets, followUps, accounts } = useWorkspaceData();
  const name = (id: string) => accounts.find((a) => a.id === id)!.name;
  // The Overview focuses on High-risk accounts; Accounts → Needs attention lists every account that qualifies.
  const attention = ranked.filter((r) => r.p.needsAttention && r.account.risk === "High");
  const overdue = followUps
    .filter((f) => f.status === "Open" && daysUntil(f.due) < 0)
    .sort((a, b) => a.due.localeCompare(b.due));
  // Same order as the Tickets list: escalated first within each priority.
  const urgent = tickets
    .filter((t) => t.status !== "Resolved" && t.priority === "High")
    .sort(compareTickets);
  const renewing = accounts.filter((a) => daysUntil(a.renewal) <= 60);

  const stats = [
    {
      label: "Accounts needing attention",
      value: attention.length,
      hot: true,
      section: "attention",
    },
    ...(overdue.length > 0
      ? [{ label: "Overdue follow-ups", value: overdue.length, hot: true, section: "overdue" }]
      : []), // hidden when nothing is overdue
    {
      label: "Urgent unresolved tickets",
      value: urgent.length,
      hot: urgent.length > 0,
      section: "urgent",
    },
    { label: "Renewals in 60 days", value: renewing.length, hot: false, section: null },
  ];
  // Cards scroll to their section below; renewals has none here, so it opens the Accounts list.
  const goToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.focus({ preventScroll: true });
    // Brief highlight, so the target is obvious even when it was already on screen.
    el.classList.add("ring-2", "ring-primary");
    setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1200);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px]">
        <h1 className="text-2xl font-semibold">Good morning, {currentUser().firstName}</h1>
        <div
          className={`mt-5 grid grid-cols-2 gap-3 sm:gap-4 ${stats.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
        >
          {stats.map((s) =>
            s.section ? (
              <button
                key={s.label}
                type="button"
                onClick={() => goToSection(s.section)}
                aria-label={`${s.label}: ${s.value}. Go to the list`}
                className={cardClass}
              >
                <CardBody value={s.value} label={s.label} hot={s.hot} />
              </button>
            ) : (
              <Link
                key={s.label}
                to="/accounts"
                search={{ view: "renewing" }}
                aria-label={`${s.label}: ${s.value}. Open the accounts renewing soon`}
                className={cardClass}
              >
                <CardBody value={s.value} label={s.label} hot={s.hot} />
              </Link>
            ),
          )}
        </div>

        <div className="mt-5 flex flex-col items-stretch gap-5 lg:flex-row lg:items-start">
          <section
            id="attention"
            tabIndex={-1}
            className="min-w-0 flex-1 scroll-mt-4 rounded-[14px] outline-none transition-shadow"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="text-sm font-semibold">Accounts needing attention</h2>
              <Link
                to="/accounts"
                className="flex max-w-32 items-center gap-1 text-xs text-primary hover:underline"
              >
                View full portfolio ({ranked.length}) <ArrowRight className="size-3" />
              </Link>
            </div>
            <PrioritisationRules />
            <ol className="mt-3 space-y-3">
              {attention.map((r, i) => (
                <li key={r.account.id} className="glass min-w-0 p-4 sm:p-5">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 sm:gap-3">
                    <span className="w-5 font-display text-lg font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="font-medium">{r.account.name}</span>
                        <RiskBadge level={r.account.risk} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.open.length} open tickets · Renewal {fmtDate(r.account.renewal)} · Owner{" "}
                        {r.account.owner}
                      </div>
                    </div>
                  </div>
                  <ul className="mt-3 sm:ml-8 flex flex-wrap gap-1.5">
                    {r.p.reasons.map((x) => (
                      <li
                        key={x.text}
                        className={`rounded-full px-2 py-0.5 text-[11px] ${x.hot ? "bg-risk/10 text-risk" : "bg-glass text-secondary-foreground"}`}
                      >
                        {x.text}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 sm:ml-8 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-sm">
                    <span className="text-muted-foreground">Next:</span>
                    <span className="font-medium">{r.p.next}</span>
                    <Link
                      to="/accounts/$id"
                      params={{ id: r.account.id }}
                      search={{}}
                      className="col-span-2 justify-self-start rounded-[10px] bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                    >
                      Open account
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <aside className="w-full shrink-0 space-y-5 lg:w-[360px]">
            {overdue.length > 0 && (
              <div
                id="overdue"
                tabIndex={-1}
                className="glass scroll-mt-4 p-5 outline-none transition-shadow"
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                  <Clock className="size-4 text-risk" />
                  <h2 className="text-sm font-semibold">Overdue follow-ups</h2>
                  <Link to="/actions" className="ml-auto text-xs text-primary hover:underline">
                    All actions
                  </Link>
                </div>
                <ul className="mt-3 space-y-2">
                  {overdue.length === 0 && (
                    <li className="text-sm text-muted-foreground">Nothing overdue.</li>
                  )}
                  {overdue.map((f) => (
                    <li key={f.id}>
                      <Link
                        to="/accounts/$id"
                        params={{ id: f.accountId }}
                        search={{}}
                        className="chip block p-3 hover:bg-glass-strong"
                      >
                        <div className="text-sm font-medium">{f.type}</div>
                        <div className="text-xs text-muted-foreground">
                          {name(f.accountId)} · {f.owner}
                        </div>
                        <div className="mt-1 text-xs text-risk">
                          {dayCount(-daysUntil(f.due))} overdue
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div
              id="urgent"
              tabIndex={-1}
              className="glass scroll-mt-4 p-5 outline-none transition-shadow"
            >
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <AlertTriangle className="size-4 text-risk" />
                <h2 className="text-sm font-semibold">Urgent unresolved tickets</h2>
                <Link to="/tickets" className="ml-auto text-xs text-primary hover:underline">
                  All tickets
                </Link>
              </div>
              <ul className="mt-3 space-y-2">
                {urgent.map((t) => (
                  <li key={t.id}>
                    <Link
                      to="/accounts/$id"
                      params={{ id: t.accountId }}
                      search={{ ticket: t.id }}
                      className="chip block p-3 hover:bg-glass-strong"
                    >
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 text-sm font-medium">
                          #{t.id} {t.title}
                        </span>
                        {t.status === "Escalated" && <EscalatedBadge />}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {name(t.accountId)}
                        {t.reopened ? " · reopened" : ""}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

const cardClass =
  "glass min-w-0 p-4 text-left transition-colors hover:bg-glass-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function CardBody({ value, label, hot }: { value: number; label: string; hot: boolean }) {
  return (
    <>
      <div className={`font-display text-3xl font-semibold ${hot ? "text-risk" : ""}`}>{value}</div>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        <ArrowRight className="size-3 opacity-60" />
      </div>
    </>
  );
}

function EscalatedBadge() {
  return (
    <span className="shrink-0 whitespace-nowrap rounded-full bg-risk/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-risk">
      Escalated
    </span>
  );
}

/** Plain-language summary of compareRanked() and prioritise() in domain/prioritise.ts. */
function PrioritisationRules() {
  return (
    <details className="group mt-1">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs text-primary hover:underline [&::-webkit-details-marker]:hidden">
        <Info className="size-3" />
        How is this prioritised?
      </summary>
      <p className="glass mt-2 p-3 text-xs text-secondary-foreground">
        Ranked by risk level first (High, Medium, Low). Within a level, by issue severity, repeat
        problems, overdue commitments, renewal proximity and customer impact — not contract value.
      </p>
    </details>
  );
}
