import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarCheck,
  Check,
  MessageSquare,
  ShieldAlert,
  Ticket as TicketIcon,
} from "lucide-react";
import { PriorityBadge, RiskBadge, StatusPill, TicketStatus } from "@/components/AppShell";
import { FollowUpDialog } from "@/components/FollowUpDialog";
import { Button } from "@/components/ui/button";
import { daysUntil, fmtDate } from "@/lib/dates";
import { compareTickets } from "@/lib/ticket-order";
import { useFollowUpActions, useWorkspaceData } from "@/lib/workspace/hooks";

/** The account record: summary, related tickets, follow-ups and activity timeline. */
export function AccountRecord({
  accountId,
  onOpenTicket,
}: {
  accountId: string;
  onOpenTicket: (t: string) => void;
}) {
  const { accounts, tickets, events, followUps } = useWorkspaceData();
  const { completeFollowUp } = useFollowUpActions();
  const a = accounts.find((x) => x.id === accountId)!;
  // Same order as the Tickets list: unresolved by priority, escalated and reopened first.
  const related = tickets.filter((t) => t.accountId === accountId).sort(compareTickets);
  const open = related.filter((t) => t.status !== "Resolved");
  const fus = followUps.filter((f) => f.accountId === accountId);
  const [dlg, setDlg] = useState(false);

  return (
    <div className="space-y-5">
      <div className="min-w-0 border-b border-border pb-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="chip grid size-10 shrink-0 place-items-center text-sm font-semibold text-accent">
            {a.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{a.name}</h1>
              <RiskBadge level={a.risk} />
            </div>
            <div className="text-xs text-muted-foreground break-words">
              {a.tier} · {a.users} users · Primary contact {a.contact} · Owner {a.owner}
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-secondary-foreground">{a.summary}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
          {[
            ["Open tickets", open.length],
            ["Reopened", open.filter((t) => t.reopened).length],
            ["Renewal", `${fmtDate(a.renewal)} (${daysUntil(a.renewal)}d)`],
            ["Sentiment", a.sentiment],
          ].map(([k, v]) => (
            <div key={k} className="chip p-2.5">
              <div className="text-muted-foreground">{k}</div>
              <div className="mt-0.5 text-sm font-medium">{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="min-w-0 border-b border-border pb-5">
        <h2 className="text-sm font-semibold">Related tickets</h2>
        <div className="mt-2 divide-y divide-border">
          {related.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-3 text-sm sm:grid-cols-[3rem_minmax(0,1fr)_6rem_4.5rem_auto]"
            >
              <span className="text-xs text-muted-foreground sm:text-sm">#{t.id}</span>
              <span
                className={`col-span-2 min-w-0 break-words sm:col-span-1 ${t.status === "Resolved" ? "text-muted-foreground" : "font-medium"}`}
              >
                {t.title}
              </span>
              <span className="flex flex-wrap items-center gap-2 text-xs sm:contents">
                <TicketStatus ticket={t} />
                <span className="sm:justify-self-start">
                  <PriorityBadge priority={t.priority} />
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenTicket(t.id)}
                aria-label={`Open ticket #${t.id}`}
                className="justify-self-end"
              >
                Open
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="min-w-0 border-b border-border pb-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="text-sm font-semibold">Follow-up actions</h2>
          <button
            onClick={() => setDlg(true)}
            className="ml-auto rounded-[10px] bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            New follow-up
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {fus.length === 0 && (
            <li className="text-sm text-muted-foreground">No follow-ups yet.</li>
          )}
          {fus.map((f) => {
            const od = f.status === "Open" && daysUntil(f.due) < 0;
            return (
              <li
                key={f.id}
                className="chip grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 p-3 text-sm sm:flex sm:items-center"
              >
                <CalendarCheck className={`size-4 ${od ? "text-risk" : "text-primary"}`} />
                <div className="min-w-0 flex-1">
                  <div
                    className={`font-medium ${f.status === "Done" ? "text-muted-foreground line-through" : ""}`}
                  >
                    {f.type}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {f.owner} · Due {fmtDate(f.due)}
                    {od && <span className="text-risk"> · overdue</span>}
                  </div>
                </div>
                {f.status === "Open" ? (
                  <button
                    onClick={() => {
                      completeFollowUp(f.id);
                      toast.success("Follow-up completed.");
                    }}
                    className="chip col-start-2 flex shrink-0 items-center justify-self-start gap-1 px-2.5 py-1 text-xs font-medium"
                  >
                    <Check className="size-3" />
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

      <div className="min-w-0 border-b border-border pb-5">
        <h2 className="text-sm font-semibold">Activity timeline</h2>
        <ol className="mt-3 space-y-3">
          {events
            .filter((e) => e.accountId === accountId)
            .sort((x, y) => Date.parse(y.date) - Date.parse(x.date))
            .map((e) => {
              const Icon =
                e.kind === "followup"
                  ? CalendarCheck
                  : e.kind === "reply"
                    ? MessageSquare
                    : e.kind === "risk"
                      ? ShieldAlert
                      : TicketIcon;
              return (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full ${e.kind === "ticket" ? "chip text-muted-foreground" : "bg-primary/15 text-primary"}`}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div>
                    <div className="font-medium">
                      {e.title}{" "}
                      <span className="font-normal text-muted-foreground">· {fmtDate(e.date)}</span>
                    </div>
                    <div className="text-xs text-secondary-foreground">{e.detail}</div>
                  </div>
                </li>
              );
            })}
        </ol>
      </div>
      {dlg && <FollowUpDialog accountId={accountId} open={dlg} onOpenChange={setDlg} />}
    </div>
  );
}
