# Design: Enterprise email automation (support inbox)

Date: 2026-08-18  
Status: Approved — scaffold + working inbound/send path

## Product goal

Any paying company can connect an institutional mailbox, let AI draft replies,
auto-handle FAQs, forward/redirect by route, and require human approval for
sensitive mail — with a professional Integrations UI even while OAuth is mocked.

## Architecture

```
Institutional inbox (Gmail/Outlook OAuth — UI scaffold)
        OR
Ionex inbound address  org+token@inbound… / webhook
        │
        ▼
POST /api/email/inbound
        │
        ▼
Start linked workflow (Support email template)
  → Classifier: auto_reply | needs_human | redirect
  → Agent drafts reply
  → Approval (needs_human)
  → email_send / email_forward
```

## Data

- `email_connections` — provider, status, address, inbound_token, default_workflow_id
- `email_messages` — audit of inbound/outbound

## Nodes

- `email_send` — reply via Resend (or demo log if no key)
- `email_forward` — redirect to ops/legal/sales address

## UI

`/dashboard/integrations` — Email hub with Connect Gmail/Outlook (demo),
inbound address, simulate email, link workflow.
