import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell, RiskBadge } from "@/components/AppShell";
import { currentUser } from "@/domain/current-user";
import { compareRanked } from "@/domain/prioritise";
import { daysUntil, fmtDate } from "@/lib/dates";
import { useRanked, useWorkspaceData } from "@/lib/workspace/hooks";

const views = [
  "My accounts",
  "Needs attention",
  "High risk",
  "Renewing soon",
  "All accounts",
] as const;
/** URL value for each view, e.g. /accounts?view=attention (linked from the Overview tiles). */
const viewSlugs = {
  "My accounts": "mine",
  "Needs attention": "attention",
  "High risk": "high-risk",
  "Renewing soon": "renewing",
  "All accounts": "all",
} as const;
const slugs = ["mine", "attention", "high-risk", "renewing", "all"] as const;

export const Route = createFileRoute("/accounts/")({
  validateSearch: zodValidator(z.object({ view: fallback(z.enum(slugs), "mine").default("mine") })),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Accounts — ResolveAI Customer Success Console" },
      {
        name: "description",
        content: "List views of your accounts: needs attention, high risk, renewing soon and more.",
      },
      { property: "og:title", content: "Accounts — ResolveAI Customer Success Console" },
      { property: "og:description", content: "Search, filter and sort your customer portfolio." },
    ],
  }),
  component: AccountsPage,
});

const sorts = {
  priority: "Priority",
  renewal: "Renewal date",
  open: "Open tickets",
  name: "Name",
} as const;

function AccountsPage() {
  const ranked = useRanked();
  const { followUps } = useWorkspaceData();
  const navigate = useNavigate();
  const { view: viewSlug } = Route.useSearch();
  const view = views.find((v) => viewSlugs[v] === viewSlug) ?? "My accounts";
  const setView = (v: (typeof views)[number]) =>
    navigate({ to: "/accounts", search: { view: viewSlugs[v] }, replace: true });
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState("All");
  const [sort, setSort] = useState<keyof typeof sorts>("priority");

  const counts = Object.fromEntries(
    views.map((v) => [v, ranked.filter((r) => inView(v, r)).length]),
  );
  function inView(v: string, r: (typeof ranked)[number]) {
    if (v === "My accounts") return r.account.owner === currentUser().id;
    if (v === "Needs attention") return r.p.needsAttention;
    if (v === "High risk") return r.account.risk === "High";
    if (v === "Renewing soon") return daysUntil(r.account.renewal) <= 60;
    return true;
  }
  const rows = ranked
    .filter((r) => inView(view, r))
    .filter((r) => risk === "All" || r.account.risk === risk)
    .filter((r) => r.account.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) =>
      sort === "renewal"
        ? a.account.renewal.localeCompare(b.account.renewal)
        : sort === "open"
          ? b.open.length - a.open.length
          : sort === "name"
            ? a.account.name.localeCompare(b.account.name)
            : compareRanked(a, b),
    );

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px]">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {views.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-[10px] px-3 py-1.5 text-sm ${view === v ? "bg-primary font-medium text-primary-foreground" : "chip text-secondary-foreground"}`}
            >
              {v} <span className="ml-1 opacity-70">{counts[v]}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search accounts"
              className="chip w-full py-2 pl-9 pr-3 text-sm outline-none"
            />
          </div>
          <select
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            className="chip px-3 py-2 text-sm outline-none"
          >
            {["All", "High", "Medium", "Low"].map((r) => (
              <option key={r} value={r}>
                {r === "All" ? "All risk levels" : `${r} risk`}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as keyof typeof sorts)}
            className="chip px-3 py-2 text-sm outline-none"
          >
            {Object.entries(sorts).map(([k, v]) => (
              <option key={k} value={k}>
                Sort: {v}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-muted-foreground">{rows.length} accounts</span>
        </div>
        <div className="mt-4 space-y-3 md:hidden">
          {rows.map((r) => {
            const fu = followUps.filter((f) => f.accountId === r.account.id && f.status === "Open");
            const overdue = fu.some((f) => daysUntil(f.due) < 0);
            return (
              <article key={r.account.id} className="glass min-w-0 p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <h2 className="break-words font-semibold">{r.account.name}</h2>
                  <RiskBadge level={r.account.risk} />
                </div>
                <p className="mt-2 text-sm text-secondary-foreground">
                  {r.p.reasons[0]?.text ?? "No active risk signals"}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Tickets</dt>
                    <dd>
                      {r.open.length} open · {r.open.filter((t) => t.reopened).length} reopened
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Renewal</dt>
                    <dd>{fmtDate(r.account.renewal)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Follow-ups</dt>
                    <dd className={overdue ? "text-risk" : ""}>
                      {fu.length ? `${fu.length} open${overdue ? " · overdue" : ""}` : "None"}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Owner</dt>
                    <dd>{r.account.owner}</dd>
                  </div>
                </dl>
                <Button asChild size="sm" className="mt-3">
                  <Link to="/accounts/$id" params={{ id: r.account.id }} search={{ ticket: "" }}>
                    Open account
                  </Link>
                </Button>
              </article>
            );
          })}
          {rows.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No accounts match.</p>
          )}
        </div>
        <div className="glass mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border">
                {[
                  "Account",
                  "Risk",
                  "Top reason",
                  "Open",
                  "Reopened",
                  "Renewal",
                  "Follow-up",
                  "Owner",
                ].map((h) => (
                  <th key={h} className="eyebrow px-4 py-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const fu = followUps.filter(
                  (f) => f.accountId === r.account.id && f.status === "Open",
                );
                const od = fu.some((f) => daysUntil(f.due) < 0);
                return (
                  <tr
                    key={r.account.id}
                    onClick={() =>
                      navigate({ to: "/accounts/$id", params: { id: r.account.id }, search: {} })
                    }
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-glass-strong"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="chip grid size-7 place-items-center text-[10px] font-semibold text-accent">
                          {r.account.initials}
                        </div>
                        <span className="font-medium">{r.account.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge level={r.account.risk} />
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-xs text-secondary-foreground">
                      {r.p.reasons[0]?.text ?? "—"}
                    </td>
                    <td className="px-4 py-3">{r.open.length}</td>
                    <td className="px-4 py-3">{r.open.filter((t) => t.reopened).length}</td>
                    <td className="px-4 py-3 text-secondary-foreground">
                      {fmtDate(r.account.renewal)}
                    </td>
                    <td className="px-4 py-3">
                      {fu.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${od ? "bg-risk/10 text-risk" : "bg-primary/10 text-primary"}`}
                        >
                          {od ? "Overdue" : `${fu.length} open`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-secondary-foreground">{r.account.owner}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No accounts match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
