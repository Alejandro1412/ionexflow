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
