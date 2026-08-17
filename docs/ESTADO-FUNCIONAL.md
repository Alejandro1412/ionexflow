# Estado funcional (smoke test local)

Última verificación automatizada: `node scripts/smoke-e2e.mjs`

## Funciona ahora

| Área | Estado |
|------|--------|
| Landing `/` | OK |
| Signup / login email+password | OK |
| Provisioning org+profile (trigger) | OK |
| Dashboard protegido | OK |
| Workflows CRUD + canvas | OK (vía API/DB + UI) |
| Ejecutar → pausa en Approval | OK |
| Approve/Reject web + API móvil | OK (resume a `completed`) |
| Billing Activate Pro (dev) | OK |
| Pricing page | OK |
| Escena Three.js (buffers estables) | OK (fix aplicado) |
| RLS + grants SQL | OK (migración de grants) |

## No funciona sin tu configuración externa

| Área | Qué falta |
|------|-----------|
| **Google OAuth** | Crear OAuth Client en Google Cloud + `GOOGLE_OAUTH_CLIENT_ID/SECRET` y reiniciar Supabase. El botón queda deshabilitado hasta `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`. |
| **Stripe Checkout real** | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, webhook. Mientras tanto usa **Activate Pro (dev)** en `/dashboard/billing`. |
| **Expo en dispositivo físico** | `EXPO_PUBLIC_*` + `EXPO_PUBLIC_API_URL` con IP LAN (no `localhost`). |

## Cómo probar tú en el navegador

1. `/signup` con email/password (no Google)
2. `/dashboard/workflows` → New workflow → **Run**
3. `/dashboard/approvals` → Approve
4. Ver logs en `/dashboard/executions`
5. `/dashboard/billing` → Activate Pro (dev) si quieres plan `active`
