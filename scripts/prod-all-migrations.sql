-- >>> 20260816120000_init_schema.sql
-- ============================================================================
-- IonexFlow — Initial schema (Phase 1)
-- organizations, profiles, workflows, workflow_executions, approvals
-- Enums, updated_at triggers, auto-provisioning on signup, and Row Level
-- Security policies scoping every table to the caller's organization.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type public.plan_status as enum ('trial', 'active', 'past_due', 'canceled');
create type public.user_role as enum ('owner', 'member');
create type public.approval_status as enum ('pending', 'approved', 'rejected');
create type public.execution_status as enum ('pending', 'running', 'paused', 'completed', 'failed');

-- ----------------------------------------------------------------------------
-- organizations
-- ----------------------------------------------------------------------------
create table public.organizations (
  id                      uuid primary key default uuid_generate_v4(),
  name                    text not null,
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  plan_status             public.plan_status not null default 'trial',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.organizations is 'A billing/tenant boundary. Every workflow, execution and profile belongs to exactly one organization.';

-- ----------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  full_name   text,
  role        public.user_role not null default 'owner',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'App-level user profile, one row per auth.users row, scoped to an organization.';

create index profiles_org_id_idx on public.profiles (org_id);

-- ----------------------------------------------------------------------------
-- workflows
-- ----------------------------------------------------------------------------
create table public.workflows (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null default 'Untitled workflow',
  nodes       jsonb not null default '[]'::jsonb,
  edges       jsonb not null default '[]'::jsonb,
  is_active   boolean not null default false,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.workflows is 'React Flow graph definition (nodes/edges) for an agent workflow, built in Phase 3.';

create index workflows_org_id_idx on public.workflows (org_id);

-- ----------------------------------------------------------------------------
-- workflow_executions
-- ----------------------------------------------------------------------------
create table public.workflow_executions (
  id            uuid primary key default uuid_generate_v4(),
  workflow_id   uuid not null references public.workflows (id) on delete cascade,
  org_id        uuid not null references public.organizations (id) on delete cascade,
  status        public.execution_status not null default 'pending',
  trigger_payload jsonb not null default '{}'::jsonb,
  logs          jsonb not null default '[]'::jsonb,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.workflow_executions is 'A single run of a workflow. Populated by the execution engine built in Phase 4.';

create index workflow_executions_org_id_idx on public.workflow_executions (org_id);
create index workflow_executions_workflow_id_idx on public.workflow_executions (workflow_id);
create index workflow_executions_status_idx on public.workflow_executions (status);

-- ----------------------------------------------------------------------------
-- approvals (human-in-the-loop gates)
-- ----------------------------------------------------------------------------
create table public.approvals (
  id            uuid primary key default uuid_generate_v4(),
  execution_id  uuid not null references public.workflow_executions (id) on delete cascade,
  org_id        uuid not null references public.organizations (id) on delete cascade,
  node_id       text not null,
  status        public.approval_status not null default 'pending',
  requested_by  uuid references public.profiles (id) on delete set null,
  reviewed_by   uuid references public.profiles (id) on delete set null,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);

comment on table public.approvals is 'Pending human approval/rejection gates surfaced to the mobile companion app (Phase 5).';

create index approvals_org_id_idx on public.approvals (org_id);
create index approvals_execution_id_idx on public.approvals (execution_id);
create index approvals_status_idx on public.approvals (status);

-- ============================================================================
-- updated_at maintenance
-- ============================================================================
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.organizations
  for each row execute procedure public.set_updated_at();

create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger set_updated_at before update on public.workflows
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- Auto-provisioning: new Supabase Auth signup -> organization + profile
-- ============================================================================
-- Signup forms (see apps/web/actions/auth.ts) pass `full_name` and optionally
-- `org_name` in the Supabase Auth `options.data` payload; this trigger reads
-- them out of auth.users.raw_user_meta_data.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_org_name text;
begin
  v_org_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'org_name', ''),
    split_part(new.email, '@', 1) || '''s Organization'
  );

  insert into public.organizations (name, plan_status)
  values (v_org_name, 'trial')
  returning id into v_org_id;

  insert into public.profiles (id, org_id, full_name, role)
  values (
    new.id,
    v_org_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'owner'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.organizations       enable row level security;
alter table public.profiles            enable row level security;
alter table public.workflows           enable row level security;
alter table public.workflow_executions enable row level security;
alter table public.approvals           enable row level security;

-- Helper: current caller's org_id, derived from their profile row.
-- SECURITY DEFINER + a fixed search_path avoids recursive-RLS lookups on
-- public.profiles and keeps the function immune to search_path hijacking.
create function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

-- Helper: is the caller an 'owner' in their org?
create function public.is_org_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- ---- organizations ----------------------------------------------------
create policy "org members can view their organization"
  on public.organizations for select
  using (id = public.current_org_id());

create policy "owners can update their organization"
  on public.organizations for update
  using (id = public.current_org_id() and public.is_org_owner());

-- Inserts into organizations happen only via the handle_new_user() trigger
-- (SECURITY DEFINER), so no direct INSERT policy is granted to clients.

-- ---- profiles -----------------------------------------------------------
create policy "org members can view profiles in their organization"
  on public.profiles for select
  using (org_id = public.current_org_id());

create policy "users can update their own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Inserts into profiles happen only via the handle_new_user() trigger.

-- ---- workflows ------------------------------------------------------------
create policy "org members can view their workflows"
  on public.workflows for select
  using (org_id = public.current_org_id());

create policy "org members can create workflows"
  on public.workflows for insert
  with check (org_id = public.current_org_id());

create policy "org members can update their workflows"
  on public.workflows for update
  using (org_id = public.current_org_id());

create policy "org members can delete their workflows"
  on public.workflows for delete
  using (org_id = public.current_org_id());

-- ---- workflow_executions ---------------------------------------------------
create policy "org members can view their executions"
  on public.workflow_executions for select
  using (org_id = public.current_org_id());

create policy "org members can create executions"
  on public.workflow_executions for insert
  with check (org_id = public.current_org_id());

create policy "org members can update their executions"
  on public.workflow_executions for update
  using (org_id = public.current_org_id());

-- ---- approvals --------------------------------------------------------------
create policy "org members can view their approvals"
  on public.approvals for select
  using (org_id = public.current_org_id());

create policy "org members can create approvals"
  on public.approvals for insert
  with check (org_id = public.current_org_id());

create policy "org members can review approvals"
  on public.approvals for update
  using (org_id = public.current_org_id());

-- ============================================================================
-- Realtime: approvals inbox is consumed live by the mobile companion app.
-- ============================================================================
alter publication supabase_realtime add table public.approvals;
alter publication supabase_realtime add table public.workflow_executions;


-- >>> 20260816200000_grant_table_privileges.sql
-- Phase 1 schema enabled RLS but omitted role grants.
-- Without these, authenticated clients get "permission denied for table ...".

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

grant all on all sequences in schema public to postgres, service_role;
grant usage, select on all sequences in schema public to authenticated;

grant execute on all functions in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to postgres, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;


-- >>> 20260818180000_notifications.sql
-- Notifications for human-in-the-loop (in-app bell + optional email fan-out).

create type public.notification_type as enum ('approval_pending', 'system');

create table public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        public.notification_type not null default 'system',
  title       text not null,
  body        text not null default '',
  href        text,
  meta        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.notifications is 'In-app notifications scoped to a user within an organization.';

create index notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index notifications_user_id_unread_idx
  on public.notifications (user_id)
  where read_at is null;

create index notifications_org_id_idx on public.notifications (org_id);

alter table public.notifications enable row level security;

create policy "users can view their own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "users can update their own notifications"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Inserts are performed by the Next.js server with the service role
-- (fan-out to all org members after an approval is created).

grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter publication supabase_realtime add table public.notifications;


-- >>> 20260818200000_email_automation.sql
-- Enterprise email automation: mailbox connections + message audit.

create type public.email_provider as enum (
  'gmail',
  'outlook',
  'resend_inbound',
  'imap'
);

create type public.email_connection_status as enum (
  'disconnected',
  'demo_connected',
  'pending_oauth',
  'active',
  'error'
);

create type public.email_direction as enum ('inbound', 'outbound', 'forward');

create table public.email_connections (
  id                   uuid primary key default uuid_generate_v4(),
  org_id               uuid not null references public.organizations (id) on delete cascade,
  provider             public.email_provider not null,
  status               public.email_connection_status not null default 'disconnected',
  display_name         text not null default 'Support inbox',
  email_address        text,
  inbound_token        text not null unique default replace(uuid_generate_v4()::text, '-', ''),
  default_workflow_id  uuid references public.workflows (id) on delete set null,
  forward_to           text,
  meta                 jsonb not null default '{}'::jsonb,
  last_error           text,
  connected_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.email_connections is
  'Institutional mailbox link per org. OAuth providers may be demo_connected until live OAuth ships; Resend inbound uses inbound_token.';

create index email_connections_org_id_idx on public.email_connections (org_id);
create unique index email_connections_org_provider_idx
  on public.email_connections (org_id, provider);

create table public.email_messages (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  connection_id   uuid references public.email_connections (id) on delete set null,
  execution_id    uuid references public.workflow_executions (id) on delete set null,
  direction       public.email_direction not null,
  from_address    text,
  to_address      text,
  subject         text,
  body_text       text,
  thread_id       text,
  status          text not null default 'received',
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index email_messages_org_id_idx on public.email_messages (org_id);
create index email_messages_connection_id_idx on public.email_messages (connection_id);

create trigger set_updated_at before update on public.email_connections
  for each row execute procedure public.set_updated_at();

alter table public.email_connections enable row level security;
alter table public.email_messages enable row level security;

create policy "org members can view email connections"
  on public.email_connections for select
  using (org_id = public.current_org_id());

create policy "org members can insert email connections"
  on public.email_connections for insert
  with check (org_id = public.current_org_id());

create policy "org members can update email connections"
  on public.email_connections for update
  using (org_id = public.current_org_id());

create policy "org members can delete email connections"
  on public.email_connections for delete
  using (org_id = public.current_org_id());

create policy "org members can view email messages"
  on public.email_messages for select
  using (org_id = public.current_org_id());

create policy "org members can insert email messages"
  on public.email_messages for insert
  with check (org_id = public.current_org_id());

grant select, insert, update, delete on public.email_connections to authenticated;
grant select, insert, update, delete on public.email_messages to authenticated;
grant all on public.email_connections to service_role;
grant all on public.email_messages to service_role;


-- >>> 20260818210000_email_imap_smtp.sql
-- Real mailbox credentials (IMAP + SMTP) for any email provider.

alter table public.email_connections
  add column if not exists username text,
  add column if not exists password text,
  add column if not exists imap_host text,
  add column if not exists imap_port int default 993,
  add column if not exists imap_secure boolean not null default true,
  add column if not exists smtp_host text,
  add column if not exists smtp_port int default 465,
  add column if not exists smtp_secure boolean not null default true,
  add column if not exists last_synced_at timestamptz;

comment on column public.email_connections.password is
  'Mailbox secret (app password recommended). Protected by RLS; prefer vault in later hardening.';


-- Team invites + scheduling + delay resume columns

-- ---------------------------------------------------------------------------
-- invites
-- ---------------------------------------------------------------------------
create table public.invites (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  email        text not null,
  role         public.user_role not null default 'member',
  token        text not null unique,
  invited_by   uuid references public.profiles (id) on delete set null,
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index invites_org_id_idx on public.invites (org_id);
create index invites_token_idx on public.invites (token);
create index invites_email_idx on public.invites (lower(email));

alter table public.invites enable row level security;

create policy "org members can view invites"
  on public.invites for select
  using (org_id = public.current_org_id());

create policy "owners can insert invites"
  on public.invites for insert
  with check (org_id = public.current_org_id() and public.is_org_owner());

create policy "owners can update invites"
  on public.invites for update
  using (org_id = public.current_org_id() and public.is_org_owner());

create policy "owners can delete invites"
  on public.invites for delete
  using (org_id = public.current_org_id() and public.is_org_owner());

grant select, insert, update, delete on public.invites to authenticated;
grant all on public.invites to service_role;

create policy "owners can remove member profiles"
  on public.profiles for delete
  using (
    org_id = public.current_org_id()
    and public.is_org_owner()
    and id <> auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Signup via invite token (auth metadata invite_token)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_org_name text;
  v_invite_token text;
  v_invite public.invites%rowtype;
  v_role public.user_role;
begin
  v_invite_token := nullif(new.raw_user_meta_data ->> 'invite_token', '');

  if v_invite_token is not null then
    select * into v_invite
    from public.invites
    where token = v_invite_token
      and accepted_at is null
      and expires_at > now()
    for update;

    if found then
      if lower(v_invite.email) <> lower(coalesce(new.email, '')) then
        raise exception 'Invite email does not match signup email';
      end if;

      insert into public.profiles (id, org_id, full_name, role)
      values (
        new.id,
        v_invite.org_id,
        coalesce(new.raw_user_meta_data ->> 'full_name', ''),
        v_invite.role
      );

      update public.invites
      set accepted_at = now()
      where id = v_invite.id;

      return new;
    end if;
  end if;

  v_org_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'org_name', ''),
    split_part(new.email, '@', 1) || '''s Organization'
  );

  insert into public.organizations (name, plan_status)
  values (v_org_name, 'trial')
  returning id into v_org_id;

  insert into public.profiles (id, org_id, full_name, role)
  values (
    new.id,
    v_org_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'owner'
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Workflow schedules
-- ---------------------------------------------------------------------------
alter table public.workflows
  add column if not exists schedule_enabled boolean not null default false,
  add column if not exists schedule_every_minutes integer,
  add column if not exists last_scheduled_at timestamptz;

alter table public.workflows
  add constraint workflows_schedule_every_minutes_check
  check (
    schedule_every_minutes is null
    or (schedule_every_minutes >= 5 and schedule_every_minutes <= 10080)
  );

-- ---------------------------------------------------------------------------
-- Email auto-sync
-- ---------------------------------------------------------------------------
alter table public.email_connections
  add column if not exists auto_sync boolean not null default true;

-- ---------------------------------------------------------------------------
-- Delay resume on executions
-- ---------------------------------------------------------------------------
alter table public.workflow_executions
  add column if not exists resume_at timestamptz,
  add column if not exists waiting_node_id text;

create index if not exists workflow_executions_resume_at_idx
  on public.workflow_executions (resume_at)
  where resume_at is not null and status = 'paused';

