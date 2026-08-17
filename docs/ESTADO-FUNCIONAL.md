# Estado funcional

Última alineación con el código: Fases 1–5 + optimizaciones SEO/perf.  
Smoke: `node scripts/smoke-e2e.mjs`

## Qué funciona ahora

| Área | Estado | Notas |
|------|--------|-------|
| Landing `/` | OK | Escena 3D solo aquí / auth |
| Signup / login email+password | OK | Trigger crea org `trial` + profile `owner` |
| Dashboard overview | OK | Conteos + nav activa |
| Workflows CRUD + canvas | OK | React Flow lazy-load |
| Ejecutar workflow | OK | Motor in-process |
| Pausa en Approval | OK | Status `paused` + fila `approvals` |
| Approve / Reject (web) | OK | Resume a `completed` / fail |
| API móvil `/api/approvals/resolve` | OK | Bearer token |
| Inbox móvil Realtime | OK | Requiere Expo + env |
| Billing Activate Pro (dev) | OK | Sin claves Stripe |
| Pricing | OK | |
| Paywall plan no trial/active | OK | |
| RLS + grants SQL | OK | Migración de grants |
| SEO (metadata, robots, sitemap, OG) | OK | Dashboard `noindex` |
| Perf dashboard (sin Three.js) | OK | |

## Qué falta o es limitado

| Área | Estado | Qué implica |
|------|--------|-------------|
| **Nodos Agent → LLM** | No implementado | Solo logs simulados; no hay OpenAI/Anthropic |
| **Ramas / paralelo** | No | Solo primera arista saliente |
| **Más tipos de nodo** | No | Solo start / agent / approval / end |
| **Invitar miembros** | No | Rol `member` existe en DB, sin UI |
| **Signup / editor en móvil** | No | Solo login + approvals |
| **Deploy cloud documentado** | Parcial | Flujo local es el soportado en docs |
| **packages/ui compartido** | Vacío | UI en `apps/web` |

## Requiere tu configuración externa

| Área | Qué falta |
|------|-----------|
| **Google OAuth** | OAuth Client (Web) en Google Cloud; redirect `http://127.0.0.1:54321/auth/v1/callback`; `GOOGLE_OAUTH_*` en `.env` raíz; `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`; reiniciar con `scripts/restart-supabase-google.ps1` |
| **Stripe Checkout real** | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` + webhook a `/api/stripe/webhook`. Sin eso: **Activate Pro (dev)** |
| **Expo en dispositivo físico** | `EXPO_PUBLIC_*` + `EXPO_PUBLIC_API_URL` con IP LAN (no `localhost`) |

## Cómo probar en el navegador (ruta feliz)

1. `/signup` (email/password).
2. `/dashboard/workflows` → New workflow → abrir → **Run**.
3. `/dashboard/approvals` → **Approve**.
4. `/dashboard/executions/[id]` → ver logs `completed`.
5. Opcional: `/dashboard/billing` → Activate Pro (dev).

## Guía larga

Ver [GUIA-DE-LA-APP.md](./GUIA-DE-LA-APP.md) (incluye ejemplo real de negocio y mapa de pantallas).
