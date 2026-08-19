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
