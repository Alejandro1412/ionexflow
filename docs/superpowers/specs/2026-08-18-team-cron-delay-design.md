# Design: Team invites, scheduled automation, delay + retries

Date: 2026-08-18  
Status: approved  
Scope: B2B process automation MVP (3 subsystems)

## Goals

1. Companies can invite teammates into one org with owner/member roles.
2. Workflows and email inboxes can run without someone clicking Sync/Run.
3. Graphs can wait (SLA/delay) and recover from transient HTTP/LLM failures.

## Non-goals (this wave)

- Multi-org membership per user
- Fine-grained RBAC beyond owner/member
- Inngest/QStash queues
- Parallel fan-out/join
- Expo push for invites

---

## 1. Team invites + roles

### Data

Table `invites`:
- `id` uuid PK
- `org_id` uuid → organizations
- `email` text (lowercased)
- `role` `user_role` default `member`
- `token` text unique
- `invited_by` uuid → profiles
- `expires_at` timestamptz
- `accepted_at` timestamptz nullable
- `created_at` timestamptz

RLS: org members can read; only owners insert/update/delete.

### Signup path

- Existing `handle_new_user` creates new org for normal signup.
- Invite accept: authenticated user OR signup with `?invite=TOKEN`:
  - Validate invite (not expired, not accepted, email matches if provided).
  - Insert/update profile into invite.org_id with invite.role (service role / secure RPC).
  - Mark invite accepted.
  - Skip creating a new org when invite is valid.

### UI

- `/dashboard/team` — list members, pending invites, invite form (owner only for mutations).
- Nav link “Team”.
- Signup form reads `invite` query param and hides org name when present.

### Permissions (MVP)

| Action | Owner | Member |
|--------|-------|--------|
| Billing | yes | no |
| Invite / revoke / change roles | yes | no |
| Connect email / integrations | yes | no |
| Edit/run workflows, approvals | yes | yes |

---

## 2. Scheduled triggers + email cron

### Cron

- Vercel cron every 5 minutes → `GET/POST /api/cron/tick`
- Auth: `Authorization: Bearer CRON_SECRET` (or `x-cron-secret`)
- Tick does:
  1. Resume delayed executions where `resume_at <= now()`
  2. Sync active email connections (IMAP)
  3. Start scheduled workflows due now

### Schema

- `workflows.schedule_cron` text nullable (e.g. `0 9 * * 1-5`) — simple cron subset OR interval minutes for MVP
- `workflows.schedule_enabled` boolean default false
- `workflows.last_scheduled_at` timestamptz nullable
- `email_connections.auto_sync` boolean default true

MVP schedule: **interval minutes** (`schedule_every_minutes`) is simpler and reliable than full cron parsing. Prefer:
- `schedule_every_minutes int null` (e.g. 60 = hourly)
- `schedule_enabled boolean`

### UI

- Integrations: auto-sync toggle per mailbox
- Workflow editor: enable schedule + every N minutes (min 5)

### Safety

- Only `is_active = true` workflows
- Cap messages/mailboxes per tick
- Idempotent email message handling (existing)

---

## 3. Delay node + retries

### Delay node

- Type: `delay`
- Data: `{ waitMinutes: number }` (default 60, max 7 days in minutes)
- Runner: set execution status `waiting`, store `resume_at` and `waiting_node_id` on execution (or in logs metadata), return pause (like approval but without human)
- Cron tick resumes: `runWorkflowGraph({ fromNodeId, skipCurrent: true })`

### Retries

- On `http`, `slack`, `webhook`, `agent`, `email_send`, `email_forward`:
  - `maxRetries` (default 2) + exponential backoff in-request (short: 500ms, 1s, 2s)
  - Log each attempt; fail run after exhaustion

### Schema

Extend `workflow_executions`:
- `resume_at` timestamptz null
- `waiting_node_id` text null
- status already has `paused` — reuse `paused` for delay OR add `waiting`. Prefer **`paused`** with a log entry `type: delay` to avoid enum migration friction; store `resume_at` + `waiting_node_id`.

---

## Env

```
CRON_SECRET=<random>
```

Document in DEPLOY.md + Vercel.

## Success criteria

1. Owner invites member → member joins same org and sees workflows.
2. Cron syncs inbox without clicking Sync.
3. Scheduled active workflow creates executions on interval.
4. Delay node pauses and resumes after `resume_at`.
5. Transient HTTP failure retries then succeeds or fails cleanly.
