-- =====================================================================
-- 0012 — Saving an AI summary can skip filling the draft
--
-- After a reply is recorded, the app refreshes the AI summary automatically.
-- That refresh must not put a new suggested reply straight into the draft
-- (a second click could record it by accident), so save_ticket_insight gets
-- p_prefill (default true = previous behaviour).
-- =====================================================================

drop function public.save_ticket_insight(text, text, text[], text, text, integer);
--> statement-breakpoint

create function public.save_ticket_insight(
  p_ticket_id text, p_summary text, p_next_steps text[], p_reply text, p_model text, p_message_count integer,
  p_prefill boolean default true
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
    draft                    = case when p_prefill and btrim(draft) = '' and status <> 'Resolved' then btrim(p_reply) else draft end
  where id = p_ticket_id
  returning p_prefill and draft = btrim(p_reply) into v_prefilled;
  if not found then raise exception 'ticket_not_found'; end if;
  return v_prefilled;
end;
$$;
--> statement-breakpoint
revoke execute on function public.save_ticket_insight(text, text, text[], text, text, integer, boolean) from public, anon, authenticated;
--> statement-breakpoint
grant execute on function public.save_ticket_insight(text, text, text[], text, text, integer, boolean) to service_role;
