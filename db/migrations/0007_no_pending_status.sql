-- =====================================================================
-- 0007 — No "Pending" ticket status
--
-- Tickets are Open, Escalated or Resolved. Existing Pending tickets become
-- Open, a check stops Pending from being used again (Postgres can't simply
-- drop an enum value), and recording a reply no longer changes the status.
-- =====================================================================

update public.tickets set status = 'Open' where status = 'Pending';
--> statement-breakpoint
alter table public.tickets add constraint tickets_status_not_pending check (status <> 'Pending');
--> statement-breakpoint

-- Same as before, except the status stays as it is.
create or replace function public.submit_simulated_reply(p_ticket_id text, p_message_id text, p_body text, p_author text)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_account  text;
  v_status   public.ticket_status;
  v_revision integer;
  v_body     text := btrim(coalesce(p_body, ''));
begin
  if v_body = '' then raise exception 'reply_empty'; end if;

  select account_id, status, draft_revision into v_account, v_status, v_revision
  from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'ticket_not_found'; end if;

  insert into public.ticket_messages (id, ticket_id, author_name, from_customer, body)
  values (p_message_id, p_ticket_id, p_author, false, v_body)
  on conflict (id) do nothing;
  if not found then return v_revision; end if;  -- already recorded by an earlier attempt

  if v_status = 'Resolved' then raise exception 'ticket_resolved'; end if;

  update public.tickets set
    draft          = '',
    draft_revision = draft_revision + 1
  where id = p_ticket_id
  returning draft_revision into v_revision;

  insert into public.timeline_events (account_id, title, detail, kind)
  values (
    v_account,
    'Simulated reply recorded on #' || p_ticket_id,
    case when char_length(v_body) > 90 then left(v_body, 90) || '…' else v_body end,
    'reply'
  );
  return v_revision;
end;
$$;
--> statement-breakpoint
revoke execute on function public.submit_simulated_reply(text, text, text, text) from public, anon, authenticated;
--> statement-breakpoint
grant execute on function public.submit_simulated_reply(text, text, text, text) to service_role;
