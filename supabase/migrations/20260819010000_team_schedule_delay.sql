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
