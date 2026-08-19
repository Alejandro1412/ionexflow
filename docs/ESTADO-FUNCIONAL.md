# Estado funcional

Última alineación con el código (auth, canvas, LLM, automations, assistant, móvil, billing stub).  
Smoke: `node scripts/smoke-e2e.mjs`  
Guía larga: [GUIA-DE-LA-APP.md](./GUIA-DE-LA-APP.md)

## Para qué es

Command center B2B: diseñar y ejecutar procesos con agentes de IA + aprobaciones humanas + auditoría, con plantillas y un asistente guía.

## Qué funciona ahora

| Área | Estado | Notas |
|------|--------|-------|
| Landing `/` | OK | Escena 3D solo marketing/auth |
| Signup / login email+password | OK | Org `trial` + owner automático |
| Google OAuth | OK* | Requiere claves + redirect Supabase |
| Dashboard overview | OK | Conteos + atajos |
| AI Automations | OK | 5 plantillas + playbooks + AI Lab |
| Workflows + canvas | OK | Agent, Classifier, Approval; Save/Run |
| Motor + LLM | OK | OpenAI/Anthropic o demo; contexto entre agents |
| Classifier (ramas) | OK | Rutas por handle/label |
| Executions + logs AI | OK | Paneles de output |
| Approvals web | OK | Con output del agente |
| Approvals móvil Realtime | OK | Expo + `EXPO_PUBLIC_*` |
| Notifications in-app + email | OK | Campana + `/dashboard/notifications`; Resend opcional |
| Nodos HTTP / Slack / Webhook | OK | Publicar tras approval; plantilla Content + publish |
| Email automation (inbox) | OK | IMAP+SMTP real (Gmail/Outlook/custom); sync + send; sin demo |
| Ionex Assistant | OK | Personalizado; fallback si 429 OpenAI |
| Billing / Pricing / paywall | OK | Stripe Checkout + portal; Activate Pro **solo local** |
| Deploy guide | OK | `docs/DEPLOY.md` (Vercel + Supabase Cloud + Stripe) |
| SEO + perf basica | OK | Favicon estático; Turbopack en dev |

\* Configuración externa necesaria (ver abajo).

## Qué falta para uso empresarial PRO

| Bloque | Estado | Impacto |
|--------|--------|---------|
| Deploy cloud + doc | OK | Guía `docs/DEPLOY.md` + `apps/web/vercel.json` — falta tu proyecto Vercel/Supabase |
| Stripe producción | OK* | Código + sync post-checkout + webhook; *faltan tus keys live en Vercel |
| Invitar equipo / roles UI | OK | `/dashboard/team` + signup `?invite=` |
| Notificaciones approval | OK | In-app + Resend opcional; sin Expo push aún |
| Integraciones (HTTP/Slack/Webhook) | OK | Nodos en canvas; sin OAuth nativo Buffer/LinkedIn |
| Jobs/colas + retries LLM en engine | OK* | Cron `/api/cron/tick` + retries agent/http/email; *requires CRON_SECRET |
| Delay node + schedules | OK | Nodo delay + schedule every N min + email auto-sync |
| Paralelismo / versiones | No | Orquestación avanzada |
| Cuotas tokens por plan | No | Control de coste |
| SSO / audit export | No | Enterprise |

## Configuración externa

| Ítem | Dónde |
|------|--------|
| LLM live | `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` en `apps/web/.env.local` |
| Email de approvals | `RESEND_API_KEY` (+ opcional `RESEND_FROM`) |
| Google OAuth | Google Cloud + `.env` raíz + `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` |
| Stripe | Keys + webhook → `/api/stripe/webhook` |
| Móvil físico | `EXPO_PUBLIC_API_URL` = IP LAN |

## Ruta feliz de prueba

1. Signup.  
2. **AI Automations** → Content marketing.  
3. Brief real → **Run**.  
4. **Approvals** → Approve.  
5. Ver **Executions**.  

## Docs

- [GUIA-DE-LA-APP.md](./GUIA-DE-LA-APP.md) — explicación minuciosa  
- [PLAN-SIGUIENTE.md](./PLAN-SIGUIENTE.md) — roadmap por fases
