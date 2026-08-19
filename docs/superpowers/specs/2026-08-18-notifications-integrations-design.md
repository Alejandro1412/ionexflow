# Design: Notifications + Integrations (HTTP / Slack / Webhook)

Date: 2026-08-18  
Status: Approved for implementation

## Goals

1. **Notifications** — When an approval is created, every org member gets an in-app notification; optional email via Resend.
2. **Integrations** — Canvas nodes `http`, `slack`, `webhook` so workflows can close the loop without copy/paste.

## Notifications

### Data
Table `notifications`:
- `id`, `org_id`, `user_id`, `type` (`approval_pending` | `system`), `title`, `body`, `href`, `meta` jsonb, `read_at`, `created_at`
- RLS: users select/update **own** rows; inserts via service role

### Flow
After `approvals.insert` (startExecution + applyApprovalDecision):
1. Load org profile IDs
2. Insert one notification per user (service role)
3. If `RESEND_API_KEY` set, email each user (auth.admin.getUserById for email)
4. Failures are logged; never fail the workflow run

### UI
- Bell in dashboard header (unread count + dropdown)
- Page `/dashboard/notifications`
- Actions: mark one / mark all read

## Integrations

### Node types
| Type | Behavior |
|------|----------|
| `http` | Arbitrary method/URL/headers/body; `failOnError` (default true) |
| `slack` | POST Slack Incoming Webhook `{ text }` |
| `webhook` | POST JSON body (Buffer/Zapier/Make style) |

### Templating
`{{agentOutput}}`, `{{trigger}}`, `{{label}}`, `{{context.<NodeLabel>}}`

### Safety
- Only `http:` / `https:` URLs
- Truncate logged response bodies
- Response stored in context + `kind: "http_output"` logs

### Template
`content-publish`: Research → Draft → Approval → Slack notify → End

## Out of scope
Expo push, OAuth connectors, org secrets vault, Buffer native API
