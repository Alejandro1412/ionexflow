# IonexFlow

B2B command center for designing, running, and supervising AI agent workflows
with human-in-the-loop approvals, automation templates, email IMAP/SMTP, and
an in-app guide (Ionex Assistant).

> **Status:** Core product usable locally + production deploy/billing path documented.  
> **Next for enterprise:** team invites/roles UI, background email sync, Expo push.

## Stack

| Layer | Choice |
| --- | --- |
| Monorepo | Turborepo + pnpm |
| Web | Next.js 14, TypeScript, Tailwind, React Flow |
| Mobile | Expo Router + Supabase Auth + Realtime |
| Database | Supabase (PostgreSQL + RLS) |
| AI | OpenAI / Anthropic (+ demo fallback) |
| Billing | Stripe Checkout + portal (Activate Pro only in local/dev) |

## Docs (start here)

| Doc | Content |
| --- | --- |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | **Ship to Vercel + Supabase Cloud + Stripe** |
| [`docs/GUIA-DE-LA-APP.md`](docs/GUIA-DE-LA-APP.md) | Full Spanish product guide |
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
4. Connect real IMAP/SMTP email (Support inbox playbook)
5. HTTP / Slack / Webhook nodes
6. In-app notifications (+ optional Resend)
7. Stripe Checkout (production-ready code; configure keys per DEPLOY.md)
8. Ionex Assistant

## Repo layout

```
apps/web/      Command center (+ vercel.json)
apps/mobile/   Approvals companion
supabase/      Migrations + local config
docs/          Product + deploy documentation
```
