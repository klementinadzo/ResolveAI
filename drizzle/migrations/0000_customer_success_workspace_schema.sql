-- =====================================================================
-- Step 2 — Customer Success workspace schema
-- DRAFT FOR REVIEW. Not applied. Creates empty tables only:
-- no seed data, no write functions, no app code changes.
--
-- Objects are created WITHOUT "if not exists" / "or replace" on purpose:
-- if any name already exists, the migration fails instead of silently
-- reusing an object with a different shape.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Allowed-value types
--    Values match the TypeScript unions in src/lib/workspace.tsx exactly.
-- ---------------------------------------------------------------------
create type public.account_tier      as enum ('Enterprise', 'Growth', 'Starter');
create type public.account_sentiment as enum ('Declining', 'Stable', 'Improving');
create type public.account_risk      as enum ('High', 'Medium', 'Low');
create type public.ticket_priority   as enum ('High', 'Medium', 'Low');
create type public.ticket_status     as enum ('Open', 'Pending', 'Escalated', 'Resolved');
create type public.follow_up_type    as enum (
  'Customer check-in',
  'Escalate to Customer Success Lead',
  'Executive outreach',
  'Recovery plan'
);
create type public.follow_up_status  as enum ('Open', 'Done');
create type public.timeline_kind     as enum ('ticket', 'followup', 'reply', 'risk');


-- ---------------------------------------------------------------------
-- 2. Tables and relationships
--    Demo-calendar values use DATE (renewal, opened, due).
--    Real event times use TIMESTAMPTZ (sent_at, occurred_at, completed_at).
--    Every child row is owned by an account; deleting a parent cascades.
-- ---------------------------------------------------------------------
create table public.accounts (
  id            text primary key,                 -- slug used in /accounts/$id
  name          text not null,
  initials      text not null,
  owner         text not null,
  tier          public.account_tier not null,
  user_count    integer not null default 0,
  arr           integer not null default 0,       -- whole currency units
  renewal_date  date not null,                    -- demo calendar
  sentiment     public.account_sentiment not null,
  risk          public.account_risk not null,
  contact_name  text not null,
  summary       text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.tickets (
  id          text primary key,                   -- display number, shown as #4812
  account_id  text not null references public.accounts (id) on delete cascade,
  title       text not null,
  category    text not null,
  priority    public.ticket_priority not null,
  status      public.ticket_status not null default 'Open',
  reopened    boolean not null default false,
  opened_on   date not null,                      -- demo calendar
  assignee    text not null default 'Unassigned',
  summary     text not null default '',
  draft       text not null default '',           -- one shared reply draft per ticket
  knowledge   text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.ticket_messages (
  id             text primary key default gen_random_uuid()::text,
  ticket_id      text not null references public.tickets (id) on delete cascade,
  author_name    text not null,
  from_customer  boolean not null,
  body           text not null,                   -- simulated reply text; never emailed
  sent_at        timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create table public.follow_ups (
  id            text primary key default gen_random_uuid()::text,
  account_id    text not null references public.accounts (id) on delete cascade,
  type          public.follow_up_type not null,
  reason        text not null,
  owner         text not null,
  due_date      date not null,                    -- demo calendar
  status        public.follow_up_status not null default 'Open',
  completed_at  timestamptz,                      -- set when status becomes Done
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.timeline_events (
  id           text primary key default gen_random_uuid()::text,
  account_id   text not null references public.accounts (id) on delete cascade,
  occurred_at  timestamptz not null default now(),
  title        text not null,
  detail       text not null default '',
  kind         public.timeline_kind not null,
  created_at   timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 3. Validation checks
--    Last line of defence; server functions will validate first.
-- ---------------------------------------------------------------------
alter table public.accounts
  add constraint accounts_id_format        check (id ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  add constraint accounts_name_length      check (char_length(btrim(name)) between 1 and 120),
  add constraint accounts_initials_length  check (char_length(btrim(initials)) between 1 and 4),
  add constraint accounts_owner_length     check (char_length(btrim(owner)) between 1 and 80),
  add constraint accounts_user_count_min   check (user_count >= 0),
  add constraint accounts_arr_min          check (arr >= 0),
  add constraint accounts_contact_length   check (char_length(btrim(contact_name)) between 1 and 120),
  add constraint accounts_summary_length   check (char_length(summary) <= 2000);

alter table public.tickets
  add constraint tickets_id_format         check (id ~ '^[0-9]{1,10}$'),
  add constraint tickets_title_length      check (char_length(btrim(title)) between 1 and 200),
  add constraint tickets_category_length   check (char_length(btrim(category)) between 1 and 60),
  add constraint tickets_assignee_length   check (char_length(btrim(assignee)) between 1 and 80),
  add constraint tickets_summary_length    check (char_length(summary) <= 2000),
  add constraint tickets_draft_length      check (char_length(draft) <= 5000),
  add constraint tickets_knowledge_count   check (cardinality(knowledge) <= 20);

alter table public.ticket_messages
  add constraint ticket_messages_id_format     check (id ~ '^[A-Za-z0-9-]{1,64}$'),
  add constraint ticket_messages_author_length check (char_length(btrim(author_name)) between 1 and 120),
  add constraint ticket_messages_body_length   check (char_length(btrim(body)) between 1 and 5000);

alter table public.follow_ups
  add constraint follow_ups_id_format        check (id ~ '^[A-Za-z0-9-]{1,64}$'),
  add constraint follow_ups_reason_length    check (char_length(btrim(reason)) between 1 and 500),
  add constraint follow_ups_owner_length     check (char_length(btrim(owner)) between 1 and 80),
  add constraint follow_ups_done_has_time    check ((status = 'Done') = (completed_at is not null));

alter table public.timeline_events
  add constraint timeline_events_id_format     check (id ~ '^[A-Za-z0-9-]{1,64}$'),
  add constraint timeline_events_title_length  check (char_length(btrim(title)) between 1 and 200),
  add constraint timeline_events_detail_length check (char_length(detail) <= 500);


-- ---------------------------------------------------------------------
-- 4. Indexes
--    Postgres indexes primary keys automatically, but not foreign keys.
--    These cover "everything for one account" and the display orderings.
-- ---------------------------------------------------------------------
create index tickets_account_id_idx          on public.tickets (account_id);
create index ticket_messages_ticket_order_idx on public.ticket_messages (ticket_id, sent_at, id);
create index follow_ups_account_id_idx       on public.follow_ups (account_id);
create index timeline_events_account_order_idx
  on public.timeline_events (account_id, occurred_at desc, created_at desc);


-- ---------------------------------------------------------------------
-- 5. Updated-at triggers
--    Keeps updated_at current on tables the UI edits.
--    Fixed empty search_path, as Supabase's security advisor requires.
-- ---------------------------------------------------------------------
create function public.workspace_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.workspace_set_updated_at();

create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.workspace_set_updated_at();

create trigger follow_ups_set_updated_at
  before update on public.follow_ups
  for each row execute function public.workspace_set_updated_at();


-- ---------------------------------------------------------------------
-- 6. Access lockdown (demo access option A: server-only)
--    RLS on with NO policies: the public/publishable key can read or
--    write nothing. Table privileges for anon/authenticated are also
--    revoked as defence in depth. Only service_role (server-side,
--    bypasses RLS) keeps access.
-- ---------------------------------------------------------------------
alter table public.accounts        enable row level security;
alter table public.tickets         enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.follow_ups      enable row level security;
alter table public.timeline_events enable row level security;

revoke all on table
  public.accounts, public.tickets, public.ticket_messages,
  public.follow_ups, public.timeline_events
  from anon, authenticated;

grant select, insert, update, delete on table
  public.accounts, public.tickets, public.ticket_messages,
  public.follow_ups, public.timeline_events
  to service_role;

revoke execute on function public.workspace_set_updated_at()
  from public, anon, authenticated;
