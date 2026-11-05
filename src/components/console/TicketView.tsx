import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Sparkles } from "lucide-react";
import { StatusPill } from "@/components/AppShell";
import { fmtDate } from "@/lib/dates";
import { useTicketActions, useWorkspaceData } from "@/lib/workspace/hooks";
import { RESOLUTION_NOTE_MAX } from "@/lib/workspace-schemas";
import { InsightCard } from "./InsightCard";

/** One ticket: the conversation, the AI briefing, the draft and the status actions. */
export function TicketView({ ticketId }: { ticketId: string }) {
  const { tickets, accounts } = useWorkspaceData();
  const { setDraft, sendReply, setTicketStatus, applyAiReply } = useTicketActions();
  const t = tickets.find((x) => x.id === ticketId)!;
  const a = accounts.find((x) => x.id === t.accountId)!;
  const closed = t.status === "Resolved";
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-col items-stretch gap-5 xl:flex-row xl:items-start">
      <section className="min-w-0 flex-1 border-b border-border pb-5 xl:border-0">
        <div className="text-xs text-muted-foreground">
          {a.name} · #{t.id}
        </div>
        <h1 className="mt-1 text-xl font-semibold">{t.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-1 font-medium ${t.priority === "High" ? "bg-risk/10 text-risk" : "chip text-secondary-foreground"}`}
          >
            {t.priority} priority
          </span>
          <StatusPill status={t.status} />
          <span className="chip rounded-full px-2.5 py-1 text-secondary-foreground">
            {t.category}
          </span>
          {t.reopened && (
            <span className="rounded-full bg-risk/10 px-2.5 py-1 text-risk">Reopened</span>
          )}
          <span className="text-muted-foreground">Opened {fmtDate(t.opened)}</span>
        </div>
        <div className="mt-5 space-y-4">
          {t.messages.map((m, i) => (
            <div key={i} className="flex gap-3">
              <div
                className={`grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${m.customer ? "bg-accent/20 text-accent" : "bg-primary/15 text-primary"}`}
              >
                {m.who
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="min-w-0 break-words">
                <div className="text-sm font-medium">
                  {m.who}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {m.customer ? a.name : "ResolveAI"}
                  </span>
                </div>
                <p className="mt-1 max-w-[60ch] text-sm text-secondary-foreground">{m.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <aside className="glass w-full shrink-0 p-4 sm:p-5 xl:w-[340px]">
        <InsightCard ticketId={t.id} />
        <div className="chip mt-3 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <BookOpen className="size-3" />
            Knowledge · demo articles
          </div>
          {t.knowledge.map((k) => (
            <div key={k} className="mt-1 text-sm">
              {k}
            </div>
          ))}
        </div>
        <div className="mt-4 mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            Response draft · saved automatically, shared with your team
          </span>
          {t.insight && !closed && t.draft.trim() !== t.insight.reply && (
            <button
              onClick={() => applyAiReply(t.id)}
              className="chip ml-auto flex items-center gap-1 px-2.5 py-1 text-xs font-medium"
            >
              <Sparkles className="size-3" />
              Use AI reply
            </button>
          )}
        </div>
        <DraftBox
          key={t.id}
          draft={t.draft}
          disabled={closed}
          onChange={(text) => setDraft(t.id, text)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            disabled={closed || !t.draft.trim()}
            onClick={() => {
              sendReply(t.id);
              toast.success("Reply added to the conversation. Email sending isn't connected yet.");
            }}
            className="rounded-[10px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Send
          </button>
          <button
            disabled={closed || resolving}
            onClick={() => setResolving(true)}
            className="chip px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Resolve
          </button>
          <button
            disabled={closed || t.status === "Escalated"}
            onClick={() => {
              setTicketStatus(t.id, "Escalated");
              toast.success("Ticket escalated to Tier-2.");
            }}
            className="chip px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Escalate
          </button>
          {closed && (
            <button
              onClick={() => setTicketStatus(t.id, "Open")}
              className="chip px-3 py-2 text-sm font-medium"
            >
              Reopen
            </button>
          )}
        </div>
        {resolving && !closed && (
          <div className="chip mt-3 p-3">
            <label htmlFor={`resolution-${t.id}`} className="text-[11px] text-muted-foreground">
              Resolution note · required
            </label>
            <textarea
              id={`resolution-${t.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={RESOLUTION_NOTE_MAX}
              placeholder="What fixed it, and what the customer was told"
              className="mt-1.5 w-full rounded-[8px] bg-background/60 p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                disabled={!note.trim()}
                onClick={() => {
                  setTicketStatus(t.id, "Resolved", note);
                  setResolving(false);
                  setNote("");
                  toast.success(
                    "Ticket resolved. Account risk is unchanged — review it in the risk panel.",
                  );
                }}
                className="rounded-[10px] bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Confirm resolve
              </button>
              <button
                onClick={() => {
                  setResolving(false);
                  setNote("");
                }}
                className="chip px-3 py-1.5 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {closed && (
          <div className="chip mt-3 p-2.5 text-sm">
            <div className="text-[11px] text-muted-foreground">Resolution note</div>
            <div className="mt-0.5 break-words">
              {t.resolutionNote ?? "No note recorded (resolved before the demo)."}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

/**
 * The draft textarea keeps its own value. The saved draft reaches the screen through
 * the query cache a tick after each keystroke, and binding the textarea to it directly
 * made the cursor jump to the end, so typing mid-text added characters at the end.
 * Changes from elsewhere (AI reply, Undo, Send, reload) still replace the text.
 */
function DraftBox({
  draft,
  disabled,
  onChange,
}: {
  draft: string;
  disabled: boolean;
  onChange: (text: string) => void;
}) {
  const [text, setText] = useState(draft);
  const typed = useRef(draft);
  useEffect(() => {
    if (draft !== typed.current) {
      typed.current = draft;
      setText(draft);
    }
  }, [draft]);

  return (
    <textarea
      value={text}
      onChange={(e) => {
        typed.current = e.target.value;
        setText(e.target.value);
        onChange(e.target.value);
      }}
      rows={6}
      disabled={disabled}
      className="chip w-full p-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
    />
  );
}
