# Manual completo de IonexFlow — guía paso a paso

Documento de producto para operadores, founders y onboarding.  
App en producción: https://ionexflow.vercel.app  
Código: https://github.com/Alejandro1412/ionexflow  

---

## 1. Qué es IonexFlow (en una frase)

IonexFlow es un **command center B2B** para diseñar, ejecutar y auditar **procesos de negocio automatizados** con **agentes de IA**, **aprobaciones humanas**, **email/IMAP**, **HTTP/Slack/webhooks**, **equipo** y **billing**.

No es solo un chatbot: es un **orquestador visual de workflows** donde la IA hace trabajo y las personas aprueban lo sensible.

---

## 2. Personas y roles

| Rol | Quién es | Qué puede hacer |
|-----|----------|-----------------|
| **Owner** | Quien crea la organización o es promovido | Billing, Team (invitar/revocar), conectar mailboxes, todo lo de member |
| **Member** | Invitado al workspace | Ver/editar workflows, ejecutar, aprobar, usar Assistant e Integrations (según políticas UI) |

Un usuario pertenece a **una** organización (1 perfil ↔ 1 org).

---

## 3. Conceptos clave (glosario)

| Concepto | Significado |
|----------|-------------|
| **Organization** | Tenant / empresa. Tiene plan (`trial`, `active`, `past_due`, `canceled`). |
| **Workflow** | Grafo visual (nodos + aristas) que define un proceso. |
| **Nodo** | Paso del proceso: Start, Agent, Classifier, Approval, Delay, HTTP, Slack, Webhook, Email, End. |
| **Execution** | Una corrida concreta de un workflow (con logs). |
| **Approval** | Pausa humana: alguien debe Approve/Reject para continuar. |
| **Trigger** | Qué dispara la corrida: Run manual, email IMAP, webhook inbound, schedule/cron. |
| **Agent** | Nodo LLM (OpenAI/Anthropic) con playbook (research, draft, sales…). |
| **Classifier** | Nodo LLM que elige una **ruta** (rama del grafo). |
| **Delay** | Espera N minutos; el cron reanuda después. |
| **AI Automations** | Plantillas listas (content, support, etc.). |
| **Ionex Assistant** | Chat guía dentro del dashboard. |

---

## 4. Primeros pasos — cuenta y acceso

### 4.1 Crear workspace (signup normal)

1. Abre `/signup`.
2. Completa: **Full name**, **Organization name**, **Work email**, **Password** (mín. 8).
3. Pulsa **Create account**.
4. El sistema crea:
   - Usuario en Auth (Supabase)
   - Organización en `trial`
   - Perfil `owner` ligado a esa org
5. Redirige a `/dashboard`.

### 4.2 Entrar (login)

1. `/login` → email + password → **Sign in**.
2. O **Continue with Google** (si está configurado OAuth + redirect en Google Cloud).

### 4.3 Unirse por invitación (team)

1. Un **owner** va a `/dashboard/team`.
2. Introduce el email del compañero + rol (`member` u `owner`).
3. Copia el link `…/signup?invite=TOKEN`.
4. El invitado abre el link (debe usar **exactamente ese email**).
5. Completa nombre + password → entra a la **misma org** (no crea org nueva).

---

## 5. Dashboard — mapa de la app

Navegación típica:

| Sección | URL | Para qué |
|---------|-----|----------|
| Overview | `/dashboard` | Resumen, plan, atajos |
| AI Automations | `/dashboard/automations` | Plantillas + AI Lab |
| Integrations | `/dashboard/integrations` | Mailbox IMAP/SMTP + sync |
| Assistant | `/dashboard/assistant` | Chat Ionex |
| Workflows | `/dashboard/workflows` | Lista de flujos |
| Editor | `/dashboard/workflows/[id]` | Canvas visual |
| Executions | `/dashboard/executions` | Historial de corridas |
| Approvals | `/dashboard/approvals` | Cola humana |
| Notifications | `/dashboard/notifications` | Campana / lista |
| Team | `/dashboard/team` | Miembros e invites |
| Billing | `/dashboard/billing` | Plan, Stripe, **uso de tokens AI** |

Si el plan es `past_due` / `canceled`, muchas pantallas redirigen a Billing (paywall).

---

## 6. Ruta feliz recomendada (primera automatización)

### Paso A — Crear desde plantilla

1. Ve a **AI Automations**.
2. Elige una plantilla (ej. Content marketing o Support email).
3. Se crea un workflow ya cableado y abres el editor.

### Paso B — Entender el canvas

- **Start**: punto de entrada (recibe el trigger).
- **Agent(s)**: generan texto con LLM (brief → borrador → etc.).
- **Classifier** (si hay): elige rama (`needs_human` vs `auto_ok`).
- **Approval**: pausa para humano.
- **HTTP / Slack / Webhook / Email**: acciones hacia el mundo exterior.
- **Delay**: espera controlada.
- **End**: fin.

Conecta nodos arrastrando handles. En classifiers, cada ruta tiene su handle.

### Paso C — Configurar un Agent

1. Selecciona el nodo Agent.
2. Elige **Playbook mode** (research, draft, sales…).
3. Ajusta **model** (ej. `gpt-4o-mini`), temperature, system/task prompt.
4. Guarda.

### Paso D — Ejecutar

1. Escribe un **trigger** de prueba en el campo de Run (brief / email simulado).
2. **Save** → **Run**.
3. Ve a **Executions** → abre la corrida → lee logs y outputs de agentes.

### Paso E — Aprobar

1. Si el flujo llegó a Approval, aparece en **Approvals** (y notificación in-app).
2. Revisa el output del agente.
3. **Approve** → el motor continúa (puede publicar a Slack/HTTP/email).
4. **Reject** → la execution falla de forma controlada.

---

## 7. Motor de workflows — qué hace cada nodo

### 7.1 Start
Registra el trigger en logs y sigue a la siguiente arista.

### 7.2 Agent (LLM)
1. Toma prompt + contexto de agentes previos + trigger.
2. Llama OpenAI o Anthropic (o **demo** si no hay key / cuota / 429).
3. Guarda el output en el contexto con la etiqueta del nodo.
4. Reintentos cortos si falla (configurable `maxRetries`).

### 7.3 Classifier (LLM)
1. Pide al modelo **exactamente una** clave de ruta.
2. Sigue la arista cuyo `sourceHandle` / label coincide.
3. Si no hay arista para esa ruta → execution failed.

### 7.4 Approval
1. Pausa (`status=paused`).
2. Crea fila en `approvals` + notificación.
3. Resume solo con Approve (salta el nodo y sigue).

### 7.5 Delay
1. Calcula `resume_at = now + waitMinutes`.
2. Pausa con `waiting_node_id`.
3. El job `/api/cron/tick` reanuda cuando toque.

### 7.6 HTTP / Slack / Webhook
- Renderiza plantillas `{{agentOutput}}`, `{{trigger}}`, `{{from}}`, etc.
- Hace request; retries; puede fallar el run si `failOnError`.

### 7.7 Email send / forward
- Envía por SMTP de la mailbox de la org (o Resend si está configurado).
- Plantillas de to/subject/body.

### 7.8 End
Marca execution `completed`.

---

## 8. Inteligencia artificial (LLM) — comportamiento real

### 8.1 Providers
Orden típico:
1. `IONEX_AI_PROVIDER` si fuerza `openai` / `anthropic` / `demo`
2. Si existe `OPENAI_API_KEY` → OpenAI
3. Si no, `ANTHROPIC_API_KEY` → Anthropic
4. Si no → **Demo intelligence** (texto sintético, sin API)

### 8.2 Cuotas mensuales
| Plan | Presupuesto aprox. |
|------|--------------------|
| `trial` | 50 000 tokens / mes |
| `active` | 500 000 tokens / mes |
| otros | 0 (producto bloqueado por billing) |

- Se contabiliza por organización.
- Si se supera → el paso degrada a **demo** (no tumba todo el SaaS) y deja aviso en logs.
- Billing muestra: runtime AI + tokens usados / presupuesto.

### 8.3 Rate limit (429)
Si OpenAI/Anthropic responde 429 / quota:
- El Assistant ya degradaba.
- Los nodos Agent/Classifier también hacen **fallback a demo** con aviso.

### 8.4 Dónde se usa LLM
- Nodos Agent y Classifier del canvas
- AI Lab (dentro de Automations)
- Ionex Assistant (chat)

---

## 9. Email automation (IMAP/SMTP)

### 9.1 Conectar mailbox
1. `/dashboard/integrations`
2. Elige preset (Gmail / Outlook / custom) o hosts manuales.
3. Usuario + **App Password** (Gmail) o credenciales IMAP/SMTP.
4. Ionex **verifica IMAP y SMTP** antes de guardar.
5. Elige **default workflow** (el que se dispara por cada mail).
6. Opcional: forward/escalate address.

### 9.2 Sync manual
Botón **Sync inbox now** → lee no leídos → crea `email_messages` → `startWorkflowRun` por mensaje.

### 9.3 Auto-sync
Checkbox **Auto-sync every 5 minutes**.  
Requiere que algo llame a:

`GET https://ionexflow.vercel.app/api/cron/tick`  
Header: `Authorization: Bearer $CRON_SECRET`

(En Vercel Hobby el cron nativo no permite cada 5 min; usa cron-job.org u otro.)

### 9.4 Webhook inbound
`POST /api/email/inbound` con token de la conexión + from/subject/body.

---

## 10. Programación (schedules)

En el editor del workflow:
1. Marca **Active**
2. Marca **Auto schedule**
3. Define **Every (min)** (≥ 5)
4. Save

El cron tick inicia una execution si pasó el intervalo desde `last_scheduled_at`.

---

## 11. Notificaciones

- Campana en el layout del dashboard
- Página `/dashboard/notifications`
- Al crear un approval: notificación in-app (+ email Resend si hay `RESEND_API_KEY`)

---

## 12. Billing y planes

| Estado | Acceso producto |
|--------|-----------------|
| `trial` | Sí |
| `active` | Sí |
| `past_due` / `canceled` | Paywall |

Owners:
- Stripe Checkout (si hay keys)
- Customer Portal (si ya hay `stripe_customer_id`)
- Activate Pro (dev) **solo local**, nunca en producción

---

## 13. Móvil (Expo)

App companion para **Approvals** con Realtime:
- Configura `EXPO_PUBLIC_*` apuntando a la API/web.
- Login → lista de approvals pendientes → resolve.

---

## 14. Operación local vs producción

### Local
1. Docker Desktop ON  
2. `npx supabase start`  
3. `npx supabase db reset` (o `db push`)  
4. `pnpm --filter web dev` → http://localhost:3000  
5. Keys en `apps/web/.env.local` (Supabase local demo keys + OpenAI)

### Producción
1. Vercel (`apps/web`) + env: Supabase Cloud, SITE_URL, OpenAI, CRON_SECRET, Stripe…
2. Migraciones en Supabase SQL Editor  
3. Auth Site URL + Redirect URLs + Google redirect URI  
4. App: https://ionexflow.vercel.app  

Guía corta de deploy: `docs/DEPLOY.md`.

---

## 15. Flujos de ejemplo (end-to-end)

### 15.1 Content marketing
Start → Research Agent → Draft Agent → Approval → Slack/Webhook → End  
1. Brief en Run  
2. IA investiga y redacta  
3. Director aprueba  
4. Se publica al canal  

### 15.2 Soporte por email
IMAP sync → Classifier → (auto reply Agent | escalate Approval + forward) → Email send  
1. Llega mail  
2. Clasifica  
3. Responde o escala a humano  

### 15.3 Con delay SLA
… → Agent → Delay 60m → Approval → …  
Útil para “esperar respuesta del cliente” o ventanas de negocio.

---

## 16. Checklist de go-live

- [ ] Signup en prod funciona  
- [ ] Google OAuth (opcional) sin `redirect_uri_mismatch`  
- [ ] `OPENAI_API_KEY` en Vercel (IA real, no demo)  
- [ ] Migraciones SQL aplicadas (incl. team + AI usage)  
- [ ] Team invite smoke test  
- [ ] Un workflow Run + Approval  
- [ ] Mailbox conectada + Sync  
- [ ] Cron externo pegando `/api/cron/tick`  
- [ ] Stripe (si cobras) + webhook  

---

## 17. Qué aún no hace (honestidad de producto)

- Streaming token-a-token en el canvas (outputs llegan al terminar el paso)
- Multi-organización por usuario / SSO enterprise
- Colas tipo Inngest (hoy: request sync + cron)
- OAuth nativo LinkedIn/Buffer (se cubre con webhook/HTTP)
- Expo push notifications
- Paralelismo verdadero (fan-out/join)
- Marketplace multi-LLM avanzado

---

## 18. Dónde mirar en el código

| Pieza | Ruta |
|-------|------|
| Runner | `apps/web/lib/engine/runner.ts` |
| LLM provider + 429/quota | `apps/web/lib/ai/provider.ts`, `quotas.ts`, `usage.ts` |
| Start run / delay resume | `apps/web/lib/engine/start-run.ts` |
| Cron tick | `apps/web/app/api/cron/tick/route.ts` |
| Team | `apps/web/app/dashboard/team`, `actions/team.ts` |
| Email | `apps/web/actions/email.ts`, `lib/email/*` |
| Deploy | `docs/DEPLOY.md` |

---

*Última actualización: 2026-08-19 — alineado con team invites, delay/schedule, cron tick, cuotas AI y OpenAI en producción.*
