# IonexFlow

Monetization-ready B2B SaaS for building, orchestrating, and monitoring
autonomous AI agent workflows visually.

> **Status: Phase 1** — monorepo scaffold, Supabase Auth, and the core
> database schema (with Row Level Security). Billing, the React Flow
> canvas, the execution engine, and the mobile approval inbox land in
> Phases 2–5.

## Stack

| Layer       | Choice                                                        |
| ----------- | -------------------------------------------------------------- |
| Monorepo    | Turborepo + pnpm workspaces                                    |
| Web         | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn-style UI |
| Mobile      | Expo (Expo Router) + NativeWind                                |
| Database    | Supabase (PostgreSQL, Row Level Security)                      |
| Auth        | Supabase Auth — email/password + Google OAuth                  |
| Billing     | Stripe (`stripe-node`) — Phase 2                                |
| Orchestration | LangChain.js / state-machine graph runner — Phase 4           |

## Repo layout

```
apps/
  web/        Next.js Command Center (landing, auth, dashboard)
  mobile/     Expo companion app (Realtime approvals — Phase 5)
packages/
  config/     Shared tsconfig + eslint presets
  ui/         Shared component library (populated in Phase 3)
supabase/
  migrations/ SQL migrations
  config.toml Local Supabase CLI config
  seed.sql    Local dev seed data
```

## Getting started

Requires Node 20+, pnpm 9+, and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
pnpm install

# 1. Start local Supabase (Postgres + Auth + Studio on http://localhost:54323)
pnpm supabase:start

# 2. Copy env files and fill in the local Supabase URL/keys printed by
#    `supabase start` (also visible via `supabase status`)
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env

# 3. Run the web app
pnpm dev:web
```

Visiting `/signup` creates an `auth.users` row; the `handle_new_user()`
trigger (see `supabase/migrations/20260816120000_init_schema.sql`)
automatically provisions an `organizations` row and an `owner` `profiles`
row for that user — no manual setup required.

### Google OAuth (local)

Set `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` in your shell
env before `supabase start` (referenced from `supabase/config.toml`), and
add `http://localhost:3000/auth/callback` as an authorized redirect URI in
the Google Cloud Console.

### Regenerating types after a schema change

```bash
pnpm supabase:migrate:new <name>   # write the new migration
pnpm supabase:reset                # apply migrations + seed locally
pnpm supabase:gen:types            # regenerate apps/web/lib/database.types.ts
```

## Database schema (Phase 1)

- **organizations** — billing/tenant boundary (`plan_status`: trial, active, past_due, canceled)
- **profiles** — one row per `auth.users`, scoped to an `org_id`, role `owner`/`member`
- **workflows** — React Flow `nodes`/`edges` JSONB graph (Phase 3)
- **workflow_executions** — a single run of a workflow (Phase 4)
- **approvals** — human-in-the-loop gates surfaced to the mobile app (Phase 5)

Every table has Row Level Security enabled, scoped via a
`current_org_id()` helper function that reads the caller's `profiles` row —
no cross-tenant reads or writes are possible through the anon/authenticated
Postgres roles.

## Roadmap

1. ✅ Monorepo, Supabase Auth, database schema + RLS
2. Stripe Checkout + webhook-driven `plan_status` sync, paywall
3. React Flow visual canvas + execution logs dashboard
4. Backend execution engine + human-in-the-loop approval logic
5. Mobile auth + Realtime approval inbox
