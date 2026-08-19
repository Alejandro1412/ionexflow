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
