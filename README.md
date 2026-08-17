# IonexFlow

B2B SaaS for building, orchestrating, and monitoring autonomous AI agent
workflows visually — with human-in-the-loop approvals and Stripe billing.

> **Status: Phases 1–5 implemented** — auth, billing, React Flow canvas,
> execution engine, and mobile Realtime approval inbox.

## Stack

| Layer | Choice |
| --- | --- |
| Monorepo | Turborepo + pnpm workspaces |
| Web | Next.js 14, TypeScript, Tailwind, React Flow, Three.js |
| Mobile | Expo Router + Supabase Auth + Realtime |
| Database | Supabase (PostgreSQL + RLS) |
| Billing | Stripe Checkout + webhooks (+ local Activate Pro bypass) |
| Engine | In-process graph runner (start → agent → approval → end) |

## Repo layout

```
apps/
  web/        Command Center (landing, auth, canvas, billing, logs)
  mobile/     Companion app (login + Realtime approvals)
packages/
  config/     Shared tsconfig + eslint
  ui/         Shared UI package (placeholder)
supabase/     Migrations, local config, seed
docs/         Product guide + design specs
```

## Getting started

Requires Node 20+, pnpm 9+, Docker, and Supabase CLI (`npx supabase` works).

```bash
pnpm install
npx supabase start
# copy URL + anon + service_role keys into apps/web/.env.local
# (see apps/web/.env.example)

pnpm dev:web
```

Optional mobile:

```bash
cp apps/mobile/.env.example apps/mobile/.env
# set EXPO_PUBLIC_* to the same local Supabase keys
# EXPO_PUBLIC_API_URL=http://localhost:3000  (use your LAN IP on a physical device)
pnpm dev:mobile
```

### Stripe (optional for local)

Set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, and
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Forward webhooks to
`/api/stripe/webhook`.

Without Stripe keys, owners can use **Activate Pro (dev)** on
`/dashboard/billing`. Trial already has product access.

## What you can do

1. Sign up → org + owner profile (DB trigger)
2. Create / edit workflows on a React Flow canvas
3. Run workflows → agent simulation logs → pause on Approval nodes
4. Approve / reject from web or mobile (engine resumes)
5. Upgrade via Stripe or local Activate Pro

See `docs/GUIA-DE-LA-APP.md` for a Spanish walkthrough.

## Database

Tables: `organizations`, `profiles`, `workflows`, `workflow_executions`,
`approvals` — all RLS-scoped by `current_org_id()`.
