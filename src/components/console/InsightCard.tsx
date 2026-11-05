import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, RefreshCw } from "lucide-react";
import { fmtDate } from "@/lib/dates";
import { useInsights, useWorkspaceData } from "@/lib/workspace/hooks";

/** The ticket's AI briefing: labelled facts, next steps, and Refresh. */
export function InsightCard({ ticketId }: { ticketId: string }) {
  const { tickets } = useWorkspaceData();
  const { refreshingInsights, generateInsight, claimAutoInsight } = useInsights();
  const t = tickets.find((x) => x.id === ticketId)!;
  const ins = t.insight;
  const [requesting, setBusy] = useState(false);
  const busy = requesting || refreshingInsights.includes(ticketId);
  const [error, setError] = useState<string | null>(null);
  const stale = !!ins && t.messages.length > ins.messageCount;

  const run = useCallback(
    async (manual: boolean) => {
      setBusy(true);
      setError(null);
      const r = await generateInsight(ticketId);
      setBusy(false);
      if (!r.ok) setError(r.error);
      else if (manual) toast.success("AI summary refreshed.");
    },
    [generateInsight, ticketId],
  );
  // Prefill: the first time a ticket without a saved briefing is opened in this
  // session, generate one (claimAutoInsight makes sure that happens only once).
  const hasInsight = !!ins;
  useEffect(() => {
    if (!hasInsight && claimAutoInsight(ticketId)) void run(false);
  }, [hasInsight, ticketId, claimAutoInsight, run]);

  return (
    <div aria-busy={busy}>
      <div className="flex items-center gap-2">
        <Bot className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">AI summary</h2>
        <button
          disabled={busy}
          onClick={() => void run(true)}
          title="Ask the AI to read the ticket and account again"
          className="chip ml-auto flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium disabled:opacity-50"
        >
          <RefreshCw className={`size-3 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Reading…" : "Refresh"}
        </button>
      </div>
      {ins ? (
        <>
          <ul className="mt-2 space-y-1 text-sm">
            {ins.summaryPoints.map((point) => {
              const i = point.indexOf(":");
              const label = i > 0 && i < 20 ? point.slice(0, i) : null;
              return (
                <li key={point} className="text-secondary-foreground">
                  {label ? (
                    <>
                      <span className="font-medium text-foreground">{label}:</span>
                      {point.slice(i + 1)}
                    </>
                  ) : (
                    point
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Next steps
          </div>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-sm">
            {ins.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="mt-2 text-[11px] text-muted-foreground">
            AI · {ins.model} · {fmtDate(ins.generatedAt)}
            {stale && (
              <span className="text-warn">
                {" "}
                · the conversation changed since; Refresh to update
              </span>
            )}
          </div>
        </>
      ) : busy ? (
        <div role="status" className="mt-2 space-y-2">
          <p className="text-sm text-muted-foreground">
            AI is reading this ticket and the account…
          </p>
          <div className="h-3 w-full animate-pulse rounded bg-glass-strong" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-glass-strong" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-glass-strong" />
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {t.summary} <span className="text-[11px]">(demo text: no AI summary yet)</span>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-risk">
          {error}{" "}
          <button onClick={() => void run(true)} className="underline">
            Try again
          </button>
        </p>
      )}
    </div>
  );
}
