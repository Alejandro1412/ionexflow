-- AI token usage tracking + monthly counters on organizations

alter table public.organizations
  add column if not exists ai_tokens_used_month integer not null default 0,
  add column if not exists ai_usage_month text;

create table if not exists public.ai_usage_events (
  id                uuid primary key default uuid_generate_v4(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  source            text not null default 'agent',
  provider          text not null default 'demo',
  model             text,
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens      integer not null default 0,
  meta              jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists ai_usage_events_org_created_idx
  on public.ai_usage_events (org_id, created_at desc);

alter table public.ai_usage_events enable row level security;

create policy "org members can view ai usage"
  on public.ai_usage_events for select
  using (org_id = public.current_org_id());

-- inserts via service role / server only
grant select on public.ai_usage_events to authenticated;
grant all on public.ai_usage_events to service_role;
