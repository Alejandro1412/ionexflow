# Estado funcional

Última alineación con el código (WhatsApp in/out + Knowledge v2 + NL + Monitors + Voice + Insights).  
Smoke: `pnpm --filter web test` · `node scripts/smoke-e2e.mjs`  
Guía: [GUIA-DE-LA-APP.md](./GUIA-DE-LA-APP.md) · Manual: [MANUAL-COMPLETO.md](./MANUAL-COMPLETO.md) · Deploy: [DEPLOY.md](./DEPLOY.md)

## Para qué es

Command center B2B: diseñar y ejecutar procesos con agentes de IA + aprobaciones humanas + auditoría, con plantillas y un asistente guía.

## Qué funciona ahora

| Área | Estado | Notas |
|------|--------|-------|
| Landing `/` | OK | Escena 3D solo marketing/auth |
| Signup / login email+password | OK | Org `trial` + owner automático |
| Google OAuth | OK* | Requiere claves + redirect Supabase |
| Dashboard overview | OK | Conteos + atajos |
| AI Automations | OK | Plantillas + **Descríbelo y te lo armo** (NL→workflow inactivo) + AI Lab |
| Knowledge | OK | `/dashboard/knowledge` — upload/texto, tipos, chunks rankeados + historial cliente en Agents |
| Monitors | OK | `/dashboard/monitors` — umbrales → dispara workflow vía cron |
| Insights / learning | OK | Rechazos/edits → suggestion + Knowledge tag `learning` |
| Voice inbound | OK | `/api/voice/webhook` + Integrations |
| Browser agent node | OK | Simulate o `BROWSER_WORKER_URL` |
| Document extract node | OK | LLM extract de `{{body}}` / plantilla |
| Industry templates | OK | Inmobiliaria, Legal, Clínica, Restaurante |
| WhatsApp Cloud API | OK | Integrations + webhook in/out texto; Approval recomendado antes de send; plantilla support |
| Workflows + canvas | OK | Agent (+ Knowledge), Classifier, Approval, Delay, Condition, HTTP/Slack/Email/WhatsApp/Browser/Extract; versions + Test run |
| Motor + LLM | OK | OpenAI/Anthropic o demo; dry-run stub side effects |
| Classifier (ramas) | OK | Rutas por handle/label |
| Cron / delays / schedules | OK | Claim atómico + reaper de `running` stuck |
| Email credentials | OK | Cifrado AES-GCM en reposo |
| Unit tests (Vitest) | OK | grafo, crypto, rate-limit, dry-run |
| Executions + logs AI | OK | Paneles de output |
| Approvals web | OK | Approve/Reject + **edit before approve** |
| Approvals Slack | OK | Botones firmados vía webhook Incoming |
| Approval SLA | OK | `slaMinutes` + cron escalation |
| Condition node | OK | Reglas deterministicas sin LLM |
| Fan-out outbound | OK | Varios Slack/email/HTTP en paralelo |
| Analytics | OK | `/dashboard/analytics` (30d) |
| Audit log | OK | `/dashboard/audit` |
| AI overage | OK | Sigue live + `ai_overage_tokens`; aviso 80% |
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
| Cuotas tokens por plan | OK | Trial 50k / Active 500k; soft fallback a demo |
| Fallback 429 en Agent | OK | Degrada a demo con aviso en logs |
| Streaming UI | No | Outputs al completar el nodo |
| SSO / audit export | No | Enterprise |

## Configuración externa

| Ítem | Dónde |
|------|--------|
| LLM live | `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` |
| Email approvals | `RESEND_API_KEY` (+ opcional `RESEND_FROM`) |
| Google OAuth | Google Cloud + `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` |
| Stripe | Keys + webhook → `/api/stripe/webhook` |
| Cron | `CRON_SECRET` → `/api/cron/tick` |
| WhatsApp verify (opcional) | `WHATSAPP_VERIFY_TOKEN` o token por conexión en Integrations |
| Voice | Token en Integrations (`/api/voice/webhook?token=…`) |
| Browser worker | `BROWSER_WORKER_URL` (+ secret opcional) |
| Móvil físico | `EXPO_PUBLIC_API_URL` = IP LAN |

## Ruta feliz de prueba

1. Signup.  
2. **Knowledge** → plantillas o PDF de políticas.  
3. **Integrations** → WhatsApp o email.  
4. **Workflows** → “Descríbelo…” o plantilla WhatsApp support.  
5. Test run → **Approvals** → Activate.  
6. Mensaje real de prueba.

## Docs

- [GUIA-DE-LA-APP.md](./GUIA-DE-LA-APP.md)  
- [MANUAL-COMPLETO.md](./MANUAL-COMPLETO.md)  
- [DEPLOY.md](./DEPLOY.md)  
- [PLAN-SIGUIENTE.md](./PLAN-SIGUIENTE.md)
