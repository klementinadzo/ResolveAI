import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { currentUser } from "@/domain/current-user";
import type { FollowUpType } from "@/domain/types";
import { addBusinessDays, today, toIso } from "@/lib/dates";
import { useFollowUpActions, useWorkspaceData } from "@/lib/workspace/hooks";

const types: FollowUpType[] = [
  "Customer check-in",
  "Escalate to Customer Success Lead",
  "Executive outreach",
  "Recovery plan",
];

export function FollowUpDialog({
  accountId,
  suggestion,
  open,
  onOpenChange,
}: {
  accountId: string;
  suggestion?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { accounts } = useWorkspaceData();
  const { createFollowUp } = useFollowUpActions();
  const account = accounts.find((a) => a.id === accountId);
  const [type, setType] = useState<FollowUpType>("Customer check-in");
  const [reason, setReason] = useState(
    suggestion ??
      "Review recent ticket pattern with the customer and agree next steps before renewal.",
  );
  const [owner, setOwner] = useState(currentUser().id);
  const [due, setDue] = useState(() => toIso(addBusinessDays(today(), 2)));

  const submit = () => {
    createFollowUp({ accountId, type, reason, owner, due });
    toast.success("Account follow-up created.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-[14px] border-0 bg-popover/90 backdrop-blur-xl">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="font-display">Create account follow-up</DialogTitle>
          <DialogDescription>Plan proactive outreach for {account?.name}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[11px] text-muted-foreground">Follow-up type</div>
            <div className="flex flex-wrap gap-2">
              {types.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`rounded-[10px] px-3 py-2 text-sm font-medium ${type === t ? "bg-primary text-primary-foreground" : "chip text-secondary-foreground"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] text-muted-foreground">Reason · AI suggested</div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="chip w-full px-3 py-2.5 text-sm outline-none"
            />
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <div className="mb-1.5 text-[11px] text-muted-foreground">Owner</div>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="chip w-full px-3 py-2 text-sm outline-none"
              >
                {[currentUser().id].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <div className="mb-1.5 text-[11px] text-muted-foreground">Due date</div>
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="chip w-full px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="chip px-3 py-2 text-sm font-medium text-secondary-foreground"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="rounded-[10px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Create follow-up
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
