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
