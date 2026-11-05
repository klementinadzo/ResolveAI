-- =====================================================================
-- 0002 — Saved user actions, business rules, AI classification storage
--
-- Every user action runs as ONE database function, so the change and its
-- timeline event are saved together or not at all. Functions are callable
-- only by service_role (server code); the public key cannot run them.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. New ticket columns
--    draft_revision: bumped when a reply is submitted; a draft save that
--      carries an older revision is ignored, so a delayed save can never
--      restore a draft after submission.
--    resolution_note: required (by set_ticket_status) when resolving.
--    ai_*: saved classification (Step 7), from the LLM or a manual override.
-- ---------------------------------------------------------------------
alter table public.tickets
  add column draft_revision   integer not null default 0,
  add column resolution_note  text,
  add column ai_urgency       public.ticket_priority,
  add column ai_category      text,
  add column ai_explanation   text,
  add column ai_source        text,
  add column ai_model         text,
  add column ai_classified_at timestamptz;
--> statement-breakpoint

alter table public.tickets
  add constraint tickets_draft_revision_min       check (draft_revision >= 0),
  add constraint tickets_resolution_note_length   check (resolution_note is null or char_length(btrim(resolution_note)) between 1 and 1000),
  add constraint tickets_ai_category_length       check (ai_category is null or char_length(btrim(ai_category)) between 1 and 60),
  add constraint tickets_ai_explanation_length    check (ai_explanation is null or char_length(ai_explanation) <= 500),
  add constraint tickets_ai_source_value          check (ai_source is null or ai_source in ('ai', 'manual')),
  add constraint tickets_ai_model_length          check (ai_model is null or char_length(ai_model) <= 100),
  add constraint tickets_ai_fields_together       check (
    (ai_source is null) = (ai_urgency is null)
    and (ai_source is null) = (ai_category is null)
    and (ai_source is null) = (ai_classified_at is null)
  );
--> statement-breakpoint


-- ---------------------------------------------------------------------
-- 2. AI request log (Step 7 spending limits)
--    One row per LLM call attempt; used to enforce a daily cap and a
--    per-ticket cooldown. Locked down like the other tables.
-- ---------------------------------------------------------------------
create table public.ai_requests (
  id            text primary key default gen_random_uuid()::text,
  ticket_id     text not null references public.tickets (id) on delete cascade,
  requested_at  timestamptz not null default now(),
  succeeded     boolean,
  error         text,
  constraint ai_requests_error_length check (error is null or char_length(error) <= 500)
);
--> statement-breakpoint
create index ai_requests_requested_at_idx on public.ai_requests (requested_at desc);
--> statement-breakpoint
create index ai_requests_ticket_idx on public.ai_requests (ticket_id, requested_at desc);
--> statement-breakpoint
alter table public.ai_requests enable row level security;
--> statement-breakpoint
revoke all on table public.ai_requests from anon, authenticated;
--> statement-breakpoint
grant select, insert, update, delete on table public.ai_requests to service_role;
--> statement-breakpoint


-- ---------------------------------------------------------------------
-- 3. Action functions (one transaction each)
-- ---------------------------------------------------------------------

-- Assign a ticket; logs "#id assigned". No-op if unchanged.
create function public.assign_ticket(p_ticket_id text, p_assignee text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_account text;
  v_current text;
begin
  select account_id, assignee into v_account, v_current
  from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'ticket_not_found'; end if;
  if v_current = p_assignee then return; end if;

  update public.tickets set assignee = p_assignee where id = p_ticket_id;
  insert into public.timeline_events (account_id, title, detail, kind)
  values (v_account, '#' || p_ticket_id || ' assigned', 'Assigned to ' || p_assignee, 'ticket');
end;
$$;
--> statement-breakpoint

-- Change ticket status.
--   Resolved  requires a non-blank note (saved on the ticket).
--   Escalated reassigns to Tier-2 Integrations.
--   Open      (reopen) clears the previous resolution note.
-- Never touches account risk: resolving a ticket does not resolve risk.
create function public.set_ticket_status(p_ticket_id text, p_status public.ticket_status, p_note text default null)
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
    assignee        = case when p_status = 'Escalated' then 'Tier-2 Integrations' else assignee end,
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

-- Save the shared draft, but only if no reply was submitted since the editor
-- loaded it (same draft_revision). Returns false when the save was ignored.
create function public.save_ticket_draft(p_ticket_id text, p_draft text, p_revision integer)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  update public.tickets set draft = p_draft
  where id = p_ticket_id and draft_revision = p_revision;
  if found then return true; end if;
  if not exists (select 1 from public.tickets where id = p_ticket_id) then
    raise exception 'ticket_not_found';
  end if;
  return false;
end;
$$;
--> statement-breakpoint

-- Record a simulated reply (never emailed). In one transaction:
-- add the message, clear the draft, bump draft_revision, Open -> Pending,
-- and log the event. p_message_id makes retries safe: a repeated call with
-- the same id changes nothing. Returns the ticket's new draft_revision.
create function public.submit_simulated_reply(p_ticket_id text, p_message_id text, p_body text, p_author text)
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
    draft_revision = draft_revision + 1,
    status         = case when status = 'Open' then 'Pending'::public.ticket_status else status end
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

-- Create a follow-up and log it. p_id (client-generated) makes retries safe.
create function public.create_follow_up(
  p_id text, p_account_id text, p_type public.follow_up_type, p_reason text, p_owner text, p_due date
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.accounts where id = p_account_id) then
    raise exception 'account_not_found';
  end if;

  insert into public.follow_ups (id, account_id, type, reason, owner, due_date)
  values (p_id, p_account_id, p_type, btrim(p_reason), p_owner, p_due)
  on conflict (id) do nothing;
  if not found then return; end if;

  insert into public.timeline_events (account_id, title, detail, kind)
  values (
    p_account_id,
    'Follow-up created: ' || p_type::text,
    left(btrim(p_reason), 400) || ' · Owner: ' || p_owner || ' · Due ' || to_char(p_due, 'FMDD Mon YYYY'),
    'followup'
  );
end;
$$;
--> statement-breakpoint

-- Complete an open follow-up and log it. No-op if already done.
create function public.complete_follow_up(p_id text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_account text;
  v_type    public.follow_up_type;
  v_reason  text;
begin
  update public.follow_ups set status = 'Done', completed_at = now()
  where id = p_id and status = 'Open'
  returning account_id, type, reason into v_account, v_type, v_reason;

  if not found then
    if not exists (select 1 from public.follow_ups where id = p_id) then
      raise exception 'follow_up_not_found';
    end if;
    return;
  end if;

  insert into public.timeline_events (account_id, title, detail, kind)
  values (v_account, 'Follow-up completed: ' || v_type::text, left(v_reason, 500), 'followup');
end;
$$;
--> statement-breakpoint

-- Set account risk manually and log it. No-op if unchanged.
create function public.set_account_risk(p_account_id text, p_risk public.account_risk)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_risk public.account_risk;
begin
  select risk into v_risk from public.accounts where id = p_account_id for update;
  if not found then raise exception 'account_not_found'; end if;
  if v_risk = p_risk then return; end if;

  update public.accounts set risk = p_risk where id = p_account_id;
  insert into public.timeline_events (account_id, title, detail, kind)
  values (p_account_id, 'Risk level set to ' || p_risk::text, 'Updated manually by You after review', 'risk');
end;
$$;
--> statement-breakpoint


-- ---------------------------------------------------------------------
-- 4. AI classification functions (Step 7, provider-independent)
-- ---------------------------------------------------------------------

-- Reserve one LLM call. Serialised with an advisory lock so concurrent
-- requests cannot exceed the limits. Every attempt counts toward the daily
-- cap; only in-flight or successful ones trigger the per-ticket cooldown.
-- Returns the request id.
create function public.begin_ai_request(p_ticket_id text, p_daily_limit integer, p_ticket_cooldown_seconds integer)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_id text;
begin
  perform pg_advisory_xact_lock(hashtext('public.ai_requests'));
  if not exists (select 1 from public.tickets where id = p_ticket_id) then
    raise exception 'ticket_not_found';
  end if;
  if (select count(*) from public.ai_requests where requested_at > now() - interval '24 hours') >= p_daily_limit then
    raise exception 'ai_daily_limit';
  end if;
  if exists (
    select 1 from public.ai_requests
    where ticket_id = p_ticket_id
      and coalesce(succeeded, true)  -- in flight or succeeded; failed attempts don't block a retry
      and requested_at > now() - make_interval(secs => p_ticket_cooldown_seconds)
  ) then
    raise exception 'ai_ticket_cooldown';
  end if;

  insert into public.ai_requests (ticket_id) values (p_ticket_id) returning id into v_id;
  return v_id;
end;
$$;
--> statement-breakpoint

-- Save a classification (from the LLM or a manual override) and log it.
create function public.save_ticket_classification(
  p_ticket_id text, p_urgency public.ticket_priority, p_category text,
  p_explanation text, p_source text, p_model text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_account text;
begin
  update public.tickets set
    ai_urgency       = p_urgency,
    ai_category      = btrim(p_category),
    ai_explanation   = p_explanation,
    ai_source        = p_source,
    ai_model         = p_model,
    ai_classified_at = now()
  where id = p_ticket_id
  returning account_id into v_account;
  if not found then raise exception 'ticket_not_found'; end if;

  insert into public.timeline_events (account_id, title, detail, kind)
  values (
    v_account,
    '#' || p_ticket_id || case when p_source = 'manual' then ' classification set manually' else ' classified by AI' end,
    'Urgency ' || p_urgency::text || ' · ' || btrim(p_category),
    'ticket'
  );
end;
$$;
--> statement-breakpoint


-- ---------------------------------------------------------------------
-- 5. Access: only server code (service_role) may run these functions.
--    Postgres lets PUBLIC execute new functions by default; remove that.
-- ---------------------------------------------------------------------
revoke execute on function
  public.assign_ticket(text, text),
  public.set_ticket_status(text, public.ticket_status, text),
  public.save_ticket_draft(text, text, integer),
  public.submit_simulated_reply(text, text, text, text),
  public.create_follow_up(text, text, public.follow_up_type, text, text, date),
  public.complete_follow_up(text),
  public.set_account_risk(text, public.account_risk),
  public.begin_ai_request(text, integer, integer),
  public.save_ticket_classification(text, public.ticket_priority, text, text, text, text)
  from public, anon, authenticated;
--> statement-breakpoint

grant execute on function
  public.assign_ticket(text, text),
  public.set_ticket_status(text, public.ticket_status, text),
  public.save_ticket_draft(text, text, integer),
  public.submit_simulated_reply(text, text, text, text),
  public.create_follow_up(text, text, public.follow_up_type, text, text, date),
  public.complete_follow_up(text),
  public.set_account_risk(text, public.account_risk),
  public.begin_ai_request(text, integer, integer),
  public.save_ticket_classification(text, public.ticket_priority, text, text, text, text)
  to service_role;
