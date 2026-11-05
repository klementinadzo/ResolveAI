import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { AppShell, StatusPill } from "@/components/AppShell";
import { dayCount, daysUntil, fmtDate } from "@/lib/dates";
import { useFollowUpActions, useWorkspaceData } from "@/lib/workspace/hooks";

export const Route = createFileRoute("/actions")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Actions — ResolveAI Customer Success Console" },
      { name: "description", content: "Account follow-ups: overdue, upcoming and completed." },
      { property: "og:title", content: "Actions — ResolveAI Customer Success Console" },
      { property: "og:description", content: "Track and complete account follow-ups." },
    ],
  }),
  component: ActionsPage,
});

// Every follow-up belongs to Mara, so "Upcoming" lists all open ones (overdue included, marked as such).
const filters = ["Overdue", "Upcoming", "Completed", "All"] as const;

function ActionsPage() {
  const { followUps, accounts } = useWorkspaceData();
  const { completeFollowUp } = useFollowUpActions();
  const name = (id: string) => accounts.find((a) => a.id === id)!.name;
  const match = (x: (typeof followUps)[number], k: string) =>
    k === "Overdue"
      ? x.status === "Open" && daysUntil(x.due) < 0
      : k === "Upcoming"
        ? x.status === "Open"
        : k === "Completed"
          ? x.status === "Done"
          : true;
  // "Overdue" only appears while something is overdue; otherwise the page opens on Upcoming.
  const overdueCount = followUps.filter((x) => match(x, "Overdue")).length;
  const visible = filters.filter((k) => k !== "Overdue" || overdueCount > 0);
  const [chosen, setF] = useState<(typeof filters)[number]>(
    overdueCount > 0 ? "Overdue" : "Upcoming",
  );
  const f = chosen === "Overdue" && overdueCount === 0 ? "Upcoming" : chosen;
  const rows = followUps.filter((x) => match(x, f)).sort((a, b) => a.due.localeCompare(b.due));

  return (
    <AppShell>
      <div className="mx-auto max-w-[1080px]">
        <h1 className="text-2xl font-semibold">Actions</h1>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {visible.map((k) => (
            <button
              key={k}
              onClick={() => setF(k)}
              className={`rounded-[10px] px-3 py-1.5 text-sm ${f === k ? "bg-primary font-medium text-primary-foreground" : "chip text-secondary-foreground"}`}
            >
              {k}{" "}
              <span className="ml-1 opacity-70">{followUps.filter((x) => match(x, k)).length}</span>
            </button>
          ))}
        </div>
        <ul className="mt-4 space-y-2">
          {rows.length === 0 && (
            <li className="glass p-6 text-center text-sm text-muted-foreground">Nothing here.</li>
          )}
          {rows.map((x) => {
            const d = daysUntil(x.due);
            return (
              <li
                key={x.id}
                className="glass grid min-w-0 grid-cols-1 items-start gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {x.type} ·{" "}
                    <Link
                      to="/accounts/$id"
                      params={{ id: x.accountId }}
                      search={{ ticket: "" }}
                      className="text-primary hover:underline"
                    >
                      {name(x.accountId)}
                    </Link>
                  </div>
                  <div className="mt-0.5 text-sm text-secondary-foreground">{x.reason}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Owner {x.owner} · Due {fmtDate(x.due)}
                    {x.status === "Open" && (
                      <span className={d < 0 ? "text-risk" : ""}>
                        {" "}
                        ·{" "}
                        {d < 0
                          ? `${dayCount(-d)} overdue`
                          : d === 0
                            ? "due today"
                            : `in ${dayCount(d)}`}
                      </span>
                    )}
                  </div>
                </div>
                {x.status === "Open" ? (
                  <button
                    onClick={() => {
                      completeFollowUp(x.id);
                      toast.success("Follow-up completed.");
                    }}
                    className="chip flex shrink-0 items-center justify-self-start gap-1 px-3 py-1.5 text-sm font-medium"
                  >
                    <Check className="size-3.5" />
                    Complete
                  </button>
                ) : (
                  <StatusPill status="Done" />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
