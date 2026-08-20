# IonexFlow

B2B command center for AI agent workflows with human approvals — email **and
WhatsApp**, company Knowledge, NL→workflow builder, monitors, and more.

> **Production:** https://ionexflow.vercel.app  
> **Status:** WhatsApp in/out · Knowledge v2 · Descríbelo y te lo armo · Monitors · Insights · Voice · Industry templates  
> **Docs:** [`docs/ESTADO-FUNCIONAL.md`](docs/ESTADO-FUNCIONAL.md) · [`docs/MANUAL-COMPLETO.md`](docs/MANUAL-COMPLETO.md) · [`docs/GUIA-DE-LA-APP.md`](docs/GUIA-DE-LA-APP.md) · [`docs/DEPLOY.md`](docs/DEPLOY.md)

## Stack

| Layer | Choice |
| --- | --- |
| Monorepo | Turborepo + pnpm |
| Web | Next.js 14, TypeScript, Tailwind, React Flow |
| Mobile | Expo Router + Supabase Auth + Realtime |
| Database | Supabase (PostgreSQL + RLS) |
| AI | OpenAI / Anthropic (+ demo fallback, monthly quotas) |
| Channels | Email IMAP/SMTP · WhatsApp Cloud API · Voice webhook · Slack/HTTP |
| Billing | Stripe Checkout + portal |

## What you can do today

1. **Sign up** → org + owner (trial)
2. **Descríbelo y te lo armo** — describe el proceso en español; la IA arma el diagrama (borrador inactivo) en Workflows / Automations
3. **Canvas manual** — Agent, Classifier, Condition, Approval (+ edit), Delay, Email, WhatsApp, HTTP/Slack/Webhook, Browser, Document extract
4. **WhatsApp** — inbound webhook → workflow; outbound `whatsapp_send` (ideal con Approval antes); plantilla *WhatsApp support*
5. **Email** — IMAP sync + SMTP send/forward (credenciales cifradas)
6. **Knowledge** — políticas/catálogo/PDF; chunks rankeados + historial del cliente en Agents
7. **Approvals** — web, móvil Realtime, Slack buttons, SLA
8. **Monitors** — umbrales proactivos → disparan un workflow
9. **Insights** — aprende de rechazos/edits → Knowledge `learning`
10. **Voice** — webhook transcript → mismo motor
11. **Test run / Safe mode** + **version history**
12. **Analytics / Audit / Team / Billing (Stripe)**
13. **Plantillas industria** — inmobiliaria, legal, clínica, restaurante

## Docs

| Doc | Content |
| --- | --- |
| [`docs/ESTADO-FUNCIONAL.md`](docs/ESTADO-FUNCIONAL.md) | Matriz de features (fuente de verdad) |
| [`docs/MANUAL-COMPLETO.md`](docs/MANUAL-COMPLETO.md) | Manual paso a paso (ES) |
| [`docs/GUIA-DE-LA-APP.md`](docs/GUIA-DE-LA-APP.md) | Narrativa de producto |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Vercel + Supabase + Stripe + WhatsApp Meta |

## Getting started

```bash
pnpm install
npx supabase start
# copy keys → apps/web/.env.local (see apps/web/.env.example)
pnpm dev:web
```

Open http://localhost:3000 → signup → **Workflows** (describe o blank) / **Integrations** (WhatsApp o email).

## Repo layout

```
apps/web/      Command center (+ vercel.json)
apps/mobile/   Approvals companion
supabase/      Migrations (source of truth)
scripts/       Cloud SQL Editor copies (`prod-migration-*.sql`)
docs/          Product + deploy documentation
```
