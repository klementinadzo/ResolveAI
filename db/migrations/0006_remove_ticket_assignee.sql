-- =====================================================================
-- 0006 — Remove ticket assignment
--
-- Mara handles every ticket, so tickets no longer have an assignee.
-- Escalating still sets status Escalated and logs "Escalated to Tier-2";
-- it just no longer reassigns the ticket. Past "#… assigned" timeline
-- entries stay as history.
-- =====================================================================

drop function public.assign_ticket(text, text);
--> statement-breakpoint

-- Same as before, minus the assignee change on escalation.
create or replace function public.set_ticket_status(p_ticket_id text, p_status public.ticket_status, p_note text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_account text;
  v_status  public.ticket_status;
  v_note    text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select account_id, status into v_account, v_status
  from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'ticket_not_found'; end if;
  if p_status = 'Resolved' and v_note is null then raise exception 'resolution_note_required'; end if;
  if p_status = v_status then return; end if;

  update public.tickets set
    status          = p_status,
    resolution_note = case when p_status = 'Resolved' then v_note
                           when p_status = 'Open' then null
                           else resolution_note end
  where id = p_ticket_id;

  insert into public.timeline_events (account_id, title, detail, kind)
  values (
    v_account,
    '#' || p_ticket_id || ' ' || lower(p_status::text),
    case p_status
      when 'Escalated' then 'Escalated to Tier-2'
      when 'Resolved'  then 'Resolved by You · Note: ' || left(v_note, 400)
      else 'Status set to ' || p_status::text
    end,
    'ticket'
  );
end;
$$;
--> statement-breakpoint

-- create or replace keeps existing grants; restate them to be explicit.
revoke execute on function public.set_ticket_status(text, public.ticket_status, text) from public, anon, authenticated;
--> statement-breakpoint
grant execute on function public.set_ticket_status(text, public.ticket_status, text) to service_role;
--> statement-breakpoint

alter table public.tickets drop column assignee;
