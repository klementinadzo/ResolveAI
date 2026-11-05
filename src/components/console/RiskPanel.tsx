import { useState } from "react";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { FollowUpDialog } from "@/components/FollowUpDialog";
import type { RiskLevel } from "@/domain/types";
import { useAccountActions, useRanked, useWorkspaceData } from "@/lib/workspace/hooks";

/** Why the account is ranked where it is, its risk level, and suggested actions. */
export function RiskPanel({
  accountId,
  onOpenTicket,
}: {
  accountId: string;
  onOpenTicket: (t: string) => void;
}) {
  const ranked = useRanked();
  const { followUps } = useWorkspaceData();
  const { setRisk } = useAccountActions();
  const r = ranked.find((x) => x.account.id === accountId)!;
  const [dlg, setDlg] = useState(false);
  const openFu = followUps.filter((f) => f.accountId === accountId && f.status === "Open");
  const high = r.open.filter((t) => t.priority === "High");

  return (
    <div className="space-y-4">
      <div className="min-w-0 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-risk" />
          <h2 className="text-sm font-semibold">Why this account is ranked</h2>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Ranked #{ranked.indexOf(r) + 1} of {ranked.length} accounts
        </div>
        <ul className="mt-3 space-y-1.5 text-sm">
          {r.p.reasons.length === 0 && (
            <li className="text-muted-foreground">No active risk signals.</li>
          )}
          {r.p.reasons.map((x) => (
            <li key={x.text} className="flex gap-2">
              <span
                className={`mt-1.5 size-1.5 shrink-0 rounded-full ${x.hot ? "bg-risk" : "bg-warn"}`}
              />
              {x.text}
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0 border-b border-border pb-4">
        <h2 className="text-sm font-semibold">Risk level</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Set by the account owner. Resolving tickets doesn't change it automatically.
        </p>
        <div className="mt-3 flex gap-1.5">
          {(["High", "Medium", "Low"] as RiskLevel[]).map((lv) => (
            <button
              key={lv}
              onClick={() => {
                if (lv !== r.account.risk) {
                  setRisk(accountId, lv);
                  toast.success(`Risk set to ${lv}.`);
                }
              }}
              className={`flex-1 rounded-[10px] px-2 py-1.5 text-xs font-medium ${r.account.risk === lv ? (lv === "High" ? "bg-risk text-primary-foreground" : lv === "Medium" ? "bg-warn text-primary-foreground" : "bg-primary text-primary-foreground") : "chip text-secondary-foreground"}`}
            >
              {lv}
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 border-b border-border pb-4">
        <h2 className="text-sm font-semibold">Suggested actions</h2>
        <div className="mt-2 rounded-[10px] bg-primary/10 p-3 text-sm text-primary">
          <div className="text-[10px] uppercase tracking-wider opacity-70">Recommended next</div>
          <div className="font-medium">{r.p.next}</div>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {high.map((t) => (
            <button
              key={t.id}
              onClick={() => onOpenTicket(t.id)}
              className="chip px-3 py-2 text-left text-sm"
            >
              Work #{t.id} · {t.title}
            </button>
          ))}
          <button
            onClick={() => setDlg(true)}
            className="rounded-[10px] bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Create account follow-up
          </button>
          {openFu.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {openFu.length} open follow-up{openFu.length > 1 ? "s" : ""} on this account
            </div>
          )}
        </div>
      </div>
      {dlg && (
        <FollowUpDialog
          accountId={accountId}
          suggestion={`Address: ${r.p.reasons
            .map((x) => x.text.toLowerCase())
            .slice(0, 3)
            .join(", ")}. Agree a recovery plan before renewal.`}
          open={dlg}
          onOpenChange={setDlg}
        />
      )}
    </div>
  );
}
