-- =====================================================================
-- 0003 — AI ticket briefing (summary, next steps, short reply)
--
-- Replaces the AI classification: one AI request per ticket now produces an
-- account-aware summary, next steps and a short reply, saved on the ticket.
-- The reply pre-fills the shared draft only when the draft is empty.
-- =====================================================================


-- 1. Remove the classification (no longer used by the app)
drop function public.save_ticket_classification(text, public.ticket_priority, text, text, text, text);
--> statement-breakpoint
alter table public.tickets
  drop column ai_urgency,
  drop column ai_category,
  drop column ai_explanation,
  drop column ai_source,
  drop column ai_model,
  drop column ai_classified_at;
--> statement-breakpoint


-- 2. Saved AI briefing per ticket
alter table public.tickets
  add column ai_summary               text,
  add column ai_next_steps            text[],
  add column ai_reply                 text,
  add column ai_insight_model         text,
  add column ai_insight_at            timestamptz,
  add column ai_insight_message_count integer;
--> statement-breakpoint
alter table public.tickets
  add constraint tickets_ai_summary_length    check (ai_summary is null or char_length(btrim(ai_summary)) between 1 and 1200),
  add constraint tickets_ai_next_steps_count  check (ai_next_steps is null or (cardinality(ai_next_steps) between 1 and 4
                                                     and char_length(array_to_string(ai_next_steps, '')) <= 800)),
  add constraint tickets_ai_reply_length      check (ai_reply is null or char_length(btrim(ai_reply)) between 1 and 1200),
  add constraint tickets_ai_insight_model_len check (ai_insight_model is null or char_length(ai_insight_model) <= 100),
  add constraint tickets_ai_insight_count_min check (ai_insight_message_count is null or ai_insight_message_count >= 0),
  add constraint tickets_ai_insight_together  check (
    (ai_insight_at is null) = (ai_summary is null)
    and (ai_insight_at is null) = (ai_next_steps is null)
    and (ai_insight_at is null) = (ai_reply is null)
    and (ai_insight_at is null) = (ai_insight_message_count is null)
  );
--> statement-breakpoint


-- 3. Save a briefing. Pre-fills the draft with the reply only if the draft is
--    empty (never overwrites what someone wrote). Returns true if it did.
create function public.save_ticket_insight(
  p_ticket_id text, p_summary text, p_next_steps text[], p_reply text, p_model text, p_message_count integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_prefilled boolean;
begin
  update public.tickets set
    ai_summary               = btrim(p_summary),
    ai_next_steps            = p_next_steps,
    ai_reply                 = btrim(p_reply),
    ai_insight_model         = p_model,
    ai_insight_at            = now(),
    ai_insight_message_count = p_message_count,
    draft                    = case when btrim(draft) = '' and status <> 'Resolved' then btrim(p_reply) else draft end
  where id = p_ticket_id
  returning draft = btrim(p_reply) into v_prefilled;
  if not found then raise exception 'ticket_not_found'; end if;
  return v_prefilled;
end;
$$;
--> statement-breakpoint
revoke execute on function public.save_ticket_insight(text, text, text[], text, text, integer) from public, anon, authenticated;
--> statement-breakpoint
grant execute on function public.save_ticket_insight(text, text, text[], text, text, integer) to service_role;
--> statement-breakpoint


-- 4. Clear the fixed demo drafts so the AI reply can fill them. Only drafts that
--    are still exactly the original demo text are cleared; edited drafts stay.
update public.tickets set draft = ''
where draft like 'Hi %, thanks for flagging this. We''re investigating "%" and will update you within one business day.'
   or draft = 'Hi Priya, thanks for your patience. We’ve traced the reporting sync failure to an expired integration token on your TMS connector and are restoring it now. I’ll confirm once your dashboards are updating again — well before your Thursday review.';
