# IonexFlow

B2B command center for designing, running, and supervising AI agent workflows
with human-in-the-loop approvals, automation templates, email IMAP/SMTP, and
an in-app guide (Ionex Assistant).

> **Status:** Production on Vercel + Supabase Cloud — hardening (atomic cron, encrypted mailboxes, Test run, workflow versions).  
> **Ops docs:** [`docs/MANUAL-COMPLETO.md`](docs/MANUAL-COMPLETO.md) (paso a paso exhaustivo).

## Stack

| Layer | Choice |
| --- | --- |
| Monorepo | Turborepo + pnpm |
| Web | Next.js 14, TypeScript, Tailwind, React Flow |
| Mobile | Expo Router + Supabase Auth + Realtime |
| Database | Supabase (PostgreSQL + RLS) |
| AI | OpenAI / Anthropic (+ demo fallback, monthly quotas) |
| Billing | Stripe Checkout + portal (Activate Pro only in local/dev) |

## Docs (start here)

| Doc | Content |
| --- | --- |
| [`docs/MANUAL-COMPLETO.md`](docs/MANUAL-COMPLETO.md) | **Manual paso a paso al máximo detalle (ES)** |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Ship to Vercel + Supabase Cloud + Stripe |
| [`docs/GUIA-DE-LA-APP.md`](docs/GUIA-DE-LA-APP.md) | Product narrative (ES) |
| [`docs/ESTADO-FUNCIONAL.md`](docs/ESTADO-FUNCIONAL.md) | Feature matrix + external config |
| [`docs/PLAN-SIGUIENTE.md`](docs/PLAN-SIGUIENTE.md) | Roadmap |

## Getting started

```bash
pnpm install
npx supabase start
# copy keys → apps/web/.env.local (see apps/web/.env.example)
# optional: OPENAI_API_KEY=...
pnpm dev:web
```

Open http://localhost:3000 → signup → **AI Automations** → run a template → **Approvals**.

## What you can do today

1. Sign up (org + owner)
2. Start from automation templates or build on the canvas
3. Run LLM agents + classifiers + human approvals
4. **Test run / Safe mode** (no real email/Slack/HTTP side effects)
5. **Workflow version history** + restore on Save
6. Connect real IMAP/SMTP email (passwords encrypted at rest)
7. HTTP / Slack / Webhook nodes
8. In-app notifications (+ optional Resend)
9. Stripe Checkout (production-ready code; configure keys per DEPLOY.md)
10. Ionex Assistant
11. Cron tick with atomic delay/schedule claims + stuck-run reaper

## Repo layout

```
apps/web/      Command center (+ vercel.json)
apps/mobile/   Approvals companion
supabase/      Migrations + local config (source of truth)
scripts/       Cloud SQL Editor copies (`prod-migration-*.sql`)
docs/          Product + deploy documentation
```
