# IonexFlow — Manual local exhaustivo (paso a paso)

> **Documento maestro de producto** (máximo detalle).  
> Actualizado: 2026-08-19 · Repo local `ionexflow/`  
> Producción: https://ionexflow.vercel.app · Código: https://github.com/Alejandro1412/ionexflow  

Complementa (más cortos): [ESTADO-FUNCIONAL.md](./ESTADO-FUNCIONAL.md) · [DEPLOY.md](./DEPLOY.md) · [PLAN-SIGUIENTE.md](./PLAN-SIGUIENTE.md) · [GUIA-DE-LA-APP.md](./GUIA-DE-LA-APP.md)

---

## Índice

1. [Qué es y qué problema resuelve](#1-qué-es-y-qué-problema-resuelve)
2. [Arquitectura en una mirada](#2-arquitectura-en-una-mirada)
3. [Roles y permisos](#3-roles-y-permisos)
4. [Glosario](#4-glosario)
5. [Variables de entorno](#5-variables-de-entorno)
6. [Arranque local](#6-arranque-local)
7. [Landing y pricing](#7-landing-y-pricing)
8. [Auth: signup, login, Google, invite, callback](#8-auth-signup-login-google-invite-callback)
9. [Shell del dashboard](#9-shell-del-dashboard)
10. [Overview](#10-overview)
11. [AI Automations + AI Lab](#11-ai-automations--ai-lab)
12. [Integrations (email IMAP/SMTP)](#12-integrations-email-imapsmtp)
13. [Ionex Assistant](#13-ionex-assistant)
14. [Workflows: lista](#14-workflows-lista)
15. [Canvas: cada control y cada nodo](#15-canvas-cada-control-y-cada-nodo)
16. [Cómo corre el motor (execution lifecycle)](#16-cómo-corre-el-motor-execution-lifecycle)
17. [Plantillas de texto `{{…}}`](#17-plantillas-de-texto-)
18. [Executions](#18-executions)
19. [Approvals (web + móvil)](#19-approvals-web--móvil)
20. [Notifications](#20-notifications)
21. [Team](#21-team)
22. [Billing + cuotas AI](#22-billing--cuotas-ai)
23. [Cron tick (automatización de fondo)](#23-cron-tick-automatización-de-fondo)
24. [Webhooks: email inbound + Stripe](#24-webhooks-email-inbound--stripe)
25. [Inteligencia artificial (LLM) al detalle](#25-inteligencia-artificial-llm-al-detalle)
26. [Tablas de base de datos](#26-tablas-de-base-de-datos)
27. [Rutas feliz recomendadas (casos de uso)](#27-rutas-feliz-recomendadas-casos-de-uso)
28. [Errores frecuentes y qué hacer](#28-errores-frecuentes-y-qué-hacer)
29. [Checklist go-live](#29-checklist-go-live)
30. [Qué aún no hace el producto](#30-qué-aún-no-hace-el-producto)
31. [Mapa de archivos en el código](#31-mapa-de-archivos-en-el-código)

---

## 1. Qué es y qué problema resuelve

### 1.1 Definición

**IonexFlow** es un *command center* B2B: las empresas **diseñan**, **ejecutan** y **auditan** procesos con:

- Agentes de IA (LLM) en un canvas visual  
- Aprobaciones humanas (HITL)  
- Email real (IMAP/SMTP)  
- Integraciones HTTP / Slack / webhooks  
- Equipo (invites + roles)  
- Billing (trial / Stripe)  
- Notificaciones in-app  

### 1.2 El problema

Usar ChatGPT suelto en la empresa genera:

1. Resultados inconsistentes (cada uno pide distinto).  
2. Riesgo de marca/legal (se publica sin revisión).  
3. Cero auditoría (quién generó qué / quién aprobó).  
4. Procesos que no se repiten mañana.

### 1.3 La solución en una frase

Convierte el trabajo con IA en un **procedimiento reutilizable**:

```
Trigger (brief / email / schedule / webhook)
  → Agent(s) LLM
  → Classifier (opcional, elige rama)
  → Approval humano (opcional)
  → Delay (opcional)
  → HTTP / Slack / Email (opcional)
  → End + historial en Executions
```

### 1.4 Qué NO es

- No es CRM, Slack ni Buffer.  
- No sustituye LinkedIn: **orquesta** hasta la decisión; la publicación puede ser webhook/HTTP o manual.  
- El chat (**Ionex Assistant**) guía; el valor está en **Workflows + Approvals + Automations**.

---

## 2. Arquitectura en una mirada

| Capa | Tecnología |
|------|------------|
| Web | Next.js 14 (`apps/web`) |
| Móvil | Expo (`apps/mobile`) — approvals |
| Auth + DB + RLS | Supabase (local Docker o Cloud) |
| Hosting web | Vercel |
| LLM | OpenAI y/o Anthropic (o demo sin keys) |
| Cobro | Stripe Checkout + webhook |
| Email transaccional opcional | Resend |
| Automatización de fondo | `GET/POST /api/cron/tick` + `CRON_SECRET` |

Multi-tenant: cada fila de negocio pertenece a un `org_id`. RLS usa `current_org_id()`.

---

## 3. Roles y permisos

| Acción | Owner | Member |
|--------|-------|--------|
| Ver/editar/ejecutar workflows | Sí | Sí |
| Approvals / notifications | Sí | Sí |
| Assistant / Automations / AI Lab | Sí | Sí |
| Conectar mailbox / Integrations UI | Sí* | Sí* |
| Invitar / revocar / quitar miembros | Sí | No |
| Billing / Checkout / Portal | Sí | No (solo lectura de estado) |
| Activate Pro (dev) | Sí (solo local) | No |

\* La UI de Integrations no bloquea por rol en todos los botones; la intención de producto es que **owners** gestionen conexiones sensibles. Billing sí está gated por `role === "owner"`.

**Modelo de membresía:** un usuario = un `profiles` = una org (no multi-org).

---

## 4. Glosario

| Término | Significado |
|---------|-------------|
| **Organization** | Empresa/tenant. Tiene `plan_status`. |
| **Profile** | Usuario de app ligado a `auth.users` + `org_id` + `role`. |
| **Workflow** | Grafo: `nodes` + `edges` JSON. |
| **Node** | Paso: start, agent, classifier, approval, delay, http, slack, webhook, email_send, email_forward, end. |
| **Edge** | Conexión entre nodos; en classifiers el `sourceHandle`/`label` es la ruta. |
| **Execution** | Una corrida: status + logs + trigger. |
| **Approval** | Pausa humana pendiente. |
| **Trigger** | Payload que inicia: Run manual, IMAP, inbound webhook, schedule. |
| **Playbook / agentMode** | Personalidad del Agent (research, draft, support…). |
| **Demo intelligence** | Respuesta sintética sin LLM real. |
| **Quota** | Tope mensual de tokens por org. |
| **Delay pause** | `paused` + `resume_at` + `waiting_node_id`. |
| **Approval pause** | `paused` sin `waiting_node_id` (hay fila en `approvals`). |

---

## 5. Variables de entorno

### 5.1 Obligatorias (web)

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Auth/API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente browser/server con RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Server: webhooks, notify, cron, invites lookup |
| `NEXT_PUBLIC_SITE_URL` | Links Checkout, invites, emails |

### 5.2 LLM

| Variable | Uso |
|----------|-----|
| `OPENAI_API_KEY` | Provider preferido si existe |
| `ANTHROPIC_API_KEY` | Alternativa |
| `IONEX_AI_PROVIDER` | Fuerza `openai` / `anthropic` / `demo` |
| `IONEX_ASSISTANT_MODEL` | Modelo opcional del chat |

### 5.3 Billing / Google / email / cron

| Variable | Uso |
|----------|-----|
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Cobro |
| `ALLOW_DEV_BILLING_BYPASS` | Solo no-prod |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` | Muestra botón Google |
| `RESEND_API_KEY`, `RESEND_FROM` | Email de approvals |
| `EMAIL_INBOUND_SECRET` | Protege `/api/email/inbound` |
| `CRON_SECRET` | Protege `/api/cron/tick` |

### 5.4 Móvil

| Variable | Uso |
|----------|-----|
| `EXPO_PUBLIC_SUPABASE_URL` | Auth móvil |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Cliente |
| `EXPO_PUBLIC_API_URL` | Base de la web (LAN IP en device físico) |

### 5.5 Local vs prod

- Local: `apps/web/.env.local` apunta a `http://127.0.0.1:54321` (Supabase Docker).  
- Prod: keys de proyecto Cloud en Vercel. **Nunca** subas `.env` / `.env.local` / `.env.vercel.production` a git.

---

## 6. Arranque local

### 6.1 Prerrequisitos

1. Node + pnpm  
2. Docker Desktop **encendido**  
3. Repo en `ionexflow/`

### 6.2 Pasos

```powershell
cd "…\ionexflow\ionexflow"
npx supabase start
npx supabase migration up --local   # o db reset si quieres BD limpia
pnpm --filter web dev
```

Abre http://localhost:3000

### 6.3 Si “localhost no funciona”

Causa #1: Docker apagado → Supabase en `:54321` caído.  
Causa #2: no hay `pnpm --filter web dev`.  
Causa #3: `.env.local` apunta a Cloud pero Auth Site URL no incluye `http://localhost:3000`.

---

## 7. Landing y pricing

### 7.1 Landing `/`

**Qué ves**

- Marca IonexFlow  
- CTAs: Start free trial → `/signup`, Sign in → `/login`  
- Pitch de producto  

**Qué hace el sistema**

- Página estática / marketing. No escribe en DB.  
- SEO: metadata + JSON-LD.

### 7.2 Pricing `/pricing`

- Compara Trial vs Pro.  
- CTAs a signup / billing.  
- Sin cobro directo en esa página.

---

## 8. Auth: signup, login, Google, invite, callback

### 8.1 Signup normal `/signup`

**Pasos de usuario**

1. Full name  
2. Organization name  
3. Work email  
4. Password (≥ 8)  
5. **Create account**

**Qué hace el backend**

1. `supabase.auth.signUp` con metadata `{ full_name, org_name }`.  
2. Trigger SQL `handle_new_user`:  
   - Crea `organizations` con `plan_status=trial`  
   - Crea `profiles` con `role=owner`  
3. Redirect a `/dashboard`.

**Errores típicos**

- Email ya registrado → mensaje de Supabase.  
- Org name vacío → validación Zod.  
- Si Auth exige confirmación de email → puede hacer falta el link de `/auth/callback` (depende de config Supabase).

### 8.2 Signup por invite `/signup?invite=TOKEN`

**Pasos**

1. Owner crea invite en Team (ver §21).  
2. Invitado abre el link.  
3. Ve “Join your team”, email **fijo** al del invite, sin campo org.  
4. Nombre + password → **Join workspace**.

**Backend**

1. Página valida invite con service role (no expirado, no accepted).  
2. Signup con metadata `{ full_name, invite_token }`.  
3. `handle_new_user`:  
   - Si token válido y email coincide → profile en esa org con el `role` del invite; marca `accepted_at`.  
   - Si no → cae al path normal (nueva org) — por eso el email debe coincidir.

**Errores**

- Email distinto al invite → excepción del trigger.  
- Token expirado/aceptado → UI de signup normal (sin join).

### 8.3 Login `/login`

1. Email + password → **Sign in** → `/dashboard`.  
2. Credenciales malas → “Invalid email or password” (genérico a propósito).

### 8.4 Google OAuth

**Condición UI:** `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.

**Pasos de configuración (ops)**

1. Supabase → Auth → Providers → Google: Client ID + Secret.  
2. Google Cloud → Authorized redirect URI:  
   `https://<PROJECT_REF>.supabase.co/auth/v1/callback`  
3. Supabase Auth URL config: Site URL + Redirect URLs de la app.  

**Flujo usuario**

1. Continue with Google → Google → vuelve a `/auth/callback` → dashboard.  

**Errores**

- `redirect_uri_mismatch` → falta URI en Google Cloud.  
- Init fallido → `/login?error=oauth_init_failed`.  
- Exchange fallido → `/auth/auth-code-error`.  
- En invite mode el botón Google se oculta (invite exige email exacto vía password signup).

### 8.5 Callback `/auth/callback`

1. Lee `code` de la query.  
2. `exchangeCodeForSession`.  
3. Redirect a `redirectTo` o `/dashboard`.

### 8.6 Sign out

Header del dashboard → Sign out → limpia sesión → `/login`.

---

## 9. Shell del dashboard

Layout compartido (`/dashboard/*`):

1. Marca / nombre de org / `plan_status`  
2. Nav: Overview, AI Automations, Integrations, Assistant, Workflows, Executions, Approvals, Notifications, Team, Billing, Pricing  
3. Campana de notificaciones  
4. Sign out  
5. Widget flotante **Ask Ionex** (si el plan no está locked)

**Paywall**

Si `plan_status` ∉ `{trial, active}`:

- Banner ámbar  
- Muchas páginas redirigen a `/dashboard/billing?paywall=1`  
- Widget Assistant oculto  

---

## 10. Overview `/dashboard`

**Qué ves**

- Saludo con tu nombre  
- Conteos: workflows, executions, approvals pending  
- Tarjeta de org: plan + role + si tienes acceso  
- Atajos a Automations / Workflows / Approvals / Billing  

**Backend**

- Lecturas agregadas a `workflows`, `workflow_executions`, `approvals` filtradas por org (RLS).

---

## 11. AI Automations + AI Lab `/dashboard/automations`

### 11.1 Badge de LLM

Muestra si corres **OpenAI live / Anthropic live / Demo intelligence**.

### 11.2 Plantillas (Process templates)

Cada tarjeta **Use this automation**:

1. Llama `createWorkflowFromTemplate(id)`.  
2. Inserta un `workflows` con grafo prearmado.  
3. Redirect al canvas `/dashboard/workflows/[id]`.

Plantillas típicas (ids en código):

| ID | Categoría | Idea |
|----|-----------|------|
| `content-marketing` | Marketing | Research → Draft → Approval |
| `content-publish` | Marketing | Tras approval → Slack/Webhook |
| `content-rewrite` | Marketing | Rewrite playbook |
| `support-triage` | Support | Classifier → ramas |
| `support-email` | Support | Playbook IMAP/email |
| `sales-qualify` | Sales | Calificar lead |
| `ops-playbook` | Ops | Checklist / ops |

### 11.3 Playbooks (solo info)

Cards que explican modos: general, research, draft, rewrite, extract, support, sales, ops.  
No crean workflows; educan para configurar Agents.

### 11.4 AI Lab

**Pasos**

1. Elige mode.  
2. Escribe prompt.  
3. Run.  
4. Ves output + modelo + provider + latencia.

**Backend**

- `runAiLab` → `generateWithMode` con `orgId` → cuenta tokens si es live.  
- Si cuota excedida / 429 → demo + aviso.

---

## 12. Integrations (email IMAP/SMTP) `/dashboard/integrations`

### 12.1 Conectar mailbox

**Pasos de usuario**

1. Elige preset: Gmail / Outlook / custom.  
2. Email + password (en Gmail: **App Password**, no la clave normal).  
3. Hosts/puertos IMAP y SMTP (presets rellenan).  
4. Opcional: workflow por defecto + forward/escalate.  
5. Submit → Ionex **verifica IMAP y SMTP** → si OK, guarda `email_connections` `status=active`.

**Qué se guarda**

- Credenciales, hosts, `inbound_token` único, `default_workflow_id`, `forward_to`, `auto_sync` (default true).  
- La **password IMAP/SMTP se cifra en reposo** (AES-256-GCM, prefijo `enc:v1:`) con `EMAIL_CREDENTIALS_ENCRYPTION_KEY` (fallback: hash de `SUPABASE_SERVICE_ROLE_KEY`). Filas antiguas en plaintext siguen leyéndose hasta reconectar.

### 12.2 Panel de mailbox activa

- Editar routing (workflow, forward, address).  
- Checkbox **Auto-sync every 5 minutes**.  
- **Save routing**.  
- **Disconnect**.  
- **Sync inbox now** (manual).  
- URL de inbound webhook + token.  
- Últimos `email_messages`.  
- Atajo a plantilla Support email.

### 12.3 Sync manual — paso a paso interno

1. Valida conexión active + `default_workflow_id`.  
2. IMAP fetch unseen (límite ~15).  
3. Por cada mail:  
   - Insert `email_messages` (inbound).  
   - `startWorkflowRun` con trigger rico (`from`, `subject`, `body`, `emailConnectionId`, …).  
   - Marca mensaje `processed` + `execution_id`.  
4. Actualiza `last_synced_at`.

### 12.4 Errores

- Credenciales incompletas → “reconnect”.  
- IMAP fail → `status=error` + `last_error`.  
- Sin workflow → “Link a default workflow first”.

---

## 13. Ionex Assistant

### 13.1 Dónde

- Página `/dashboard/assistant`  
- Widget flotante en el shell  

### 13.2 Pasos

1. Escribes un mensaje.  
2. El cliente manda historial a `POST /api/assistant/chat` (sesión requerida).  
3. Responde con contexto: nombre, org, role, plan.  

### 13.3 Comportamiento LLM

- Con keys: modelo real.  
- Sin keys: demo conversacional.  
- 429 OpenAI: **fallback de guía local** (sigue respondiendo).  

---

## 14. Workflows: lista `/dashboard/workflows`

**Acciones**

1. **New workflow** → grafo default (Research → Draft → Approval → End) → abre editor.  
2. Cada fila: nombre, Active/Inactive, Edit, Delete.  

**Delete** borra el workflow (RLS org). Executions históricas pueden quedar referenciadas según FK (ver migraciones).

---

## 15. Canvas: cada control y cada nodo `/dashboard/workflows/[id]`

### 15.1 Controles de cabecera

| Control | Qué hace |
|---------|----------|
| Workflow name | Nombre persistido en Save |
| Active | `is_active` — schedules solo corren si active |
| Auto schedule | `schedule_enabled` |
| Every (min) | `schedule_every_minutes` (≥ 5, ≤ 10080) |
| + Agent / Classifier / Approval / Delay / HTTP / Slack / Webhook / Email / Forward | Añade nodo |
| Save | Persiste nodos/edges/flags **y crea snapshot** en `workflow_versions` |
| Test run | Save + ejecución `dryRun`: stub email/HTTP/Slack/webhook; **salta delays** |
| Run (safe) / Run live | Depende del checkbox **Safe mode** (default ON) |
| Version history | Lista recientes; **Restore** vuelve a ese snapshot (y guarda de nuevo) |
| Campo trigger/brief | Payload `input` de la corrida manual |
| Banner AI | Live vs Demo |

### 15.2 Cómo conectar

1. Arrastra desde el handle de salida al de entrada.  
2. En **Classifier**, cada ruta tiene handle; la arista lleva `sourceHandle`/`label` = nombre de ruta.  
3. Si el modelo elige `needs_human` pero no hay edge con ese label → execution **failed**.

### 15.3 Inspector (nodo seleccionado)

Campos según tipo: label, playbook, model, temperature, system/task prompt, routes, waitMinutes, maxRetries, URL, method, headers JSON, body template, message Slack, to/subject/body email, failOnError.

### 15.4 Detalle por tipo de nodo

#### Start
- Entrada del grafo.  
- Loguea el trigger y avanza.

#### Agent
1. Toma prompt + system (playbook) + contexto de agentes previos + trigger.  
2. Llama LLM (con retries).  
3. Guarda texto en `context[label]`.  
4. Log `kind=agent_output` con model/provider/latency.  
5. Si notice (cuota/429) → log warn.

#### Classifier
1. Fuerza una sola route key.  
2. Normaliza respuesta a una de las rutas CSV.  
3. Sigue edge matching.

#### Approval
1. Pausa execution (`paused`).  
2. Insert `approvals` pending + payload (mensaje, agent output…).  
3. Notifica a todos los perfiles de la org.  
4. Resume solo con Approve (salta el nodo). Reject → failed.

#### Delay
1. `waitMinutes` (1–10080).  
2. `resume_at = now + minutes`.  
3. Guarda `waiting_node_id`.  
4. Status `paused`.  
5. Cron resume con `skipCurrent=true`.

#### HTTP
- method, URL, headers JSON, body template.  
- Retries.  
- `failOnError` (default true).

#### Slack
- URL = Incoming Webhook.  
- Body = `{ text: message|template }`.

#### Webhook
- POST a tu URL con JSON (por defecto incluye content/trigger).

#### Email send
- to/subject/body con templates.  
- Envía vía SMTP de la mailbox de la org (o fallback Resend si está configurado).

#### Email forward
- Similar; defaults Fwd: / cuerpo de reenvío.  
- Suele usar `{{to}}` = forward_to del trigger.

#### End
- Marca execution `completed`.

---

## 16. Cómo corre el motor (execution lifecycle)

```
startWorkflowRun
  → insert workflow_executions status=running
  → runWorkflowGraph(nodes, edges, trigger)
       ├─ completed → status=completed + completed_at
       ├─ failed    → status=failed
       ├─ paused (approval) → status=paused + insert approvals + notify
       └─ waiting (delay)   → status=paused + resume_at + waiting_node_id
```

**Resume approval:** `applyApprovalDecision`  
**Resume delay:** `resumeWaitingExecution` (cron)

**Guard:** máximo ~100 pasos (anti-loop).

**Orígenes de start**

| Origen | Quién llama |
|--------|-------------|
| Botón Run | `startExecution` (sesión usuario) |
| Sync IMAP | `syncMailboxNow` / cron |
| Inbound webhook | `processInboundEmailPayload` |
| Schedule | cron tick |

Siempre conviene que el trigger lleve `orgId` (el engine lo usa para cuotas AI).

---

## 17. Plantillas de texto `{{…}}`

Disponibles al renderizar HTTP/Slack/Email (aprox.):

| Variable | Origen |
|----------|--------|
| `{{agentOutput}}` | Último output de agent en logs |
| `{{trigger}}` | `trigger.input` o JSON del trigger |
| `{{from}}` `{{to}}` `{{subject}}` `{{body}}` | Campos email del trigger |
| `{{label}}` | Label del nodo |
| `{{context.*}}` / valores por label | Contexto acumulado |

---

## 18. Executions

### 18.1 Lista `/dashboard/executions`

- Filas con status + tiempo.  
- Click → detalle.

### 18.2 Detalle `/dashboard/executions/[id]`

- Timeline de logs (info/warn/error/success).  
- Paneles de outputs (agent/http/email).  
- Link a approval pendiente si aplica.

**Statuses:** `pending` | `running` | `paused` | `completed` | `failed`.

**Cómo distinguir pausas**

- Approval: hay fila en `approvals` pending.  
- Delay: `waiting_node_id` + `resume_at` no null.

---

## 19. Approvals (web + móvil)

### 19.1 Web `/dashboard/approvals`

1. Ves cards: label, mensaje, preview del agent.  
2. **Approve** → motor continúa después del nodo.  
3. **Reject** → execution `failed`.  
4. Link a execution.

### 19.2 Móvil (Expo)

1. Login con mismas credenciales Supabase.  
2. Lista pending (Realtime).  
3. Approve/Reject → `POST /api/approvals/resolve` con Bearer token.  
4. Pull to refresh / sign out.

**Env móvil:** `EXPO_PUBLIC_SUPABASE_*` + `EXPO_PUBLIC_API_URL` (IP LAN en físico).

**Nota:** aún no hay Expo push; las notificaciones push quedan pendientes.

---

## 20. Notifications

### 20.1 Campana + `/dashboard/notifications`

- Badge unread.  
- Lista title/body/href.  
- Mark one / mark all read.

### 20.2 Cuándo se crean

Al crear un approval: una notificación por cada profile de la org (service role).  
Opcional: email Resend a cada usuario si hay `RESEND_API_KEY`.

Los fallos de notify **no rompen** el workflow.

---

## 21. Team `/dashboard/team`

### 21.1 Members

- Lista nombre + role.  
- Owner puede **Remove** a otros (borra `profiles`, no necesariamente `auth.users`).

### 21.2 Invite

1. Email + role (member/owner).  
2. Genera token 7 días.  
3. Muestra URL `/signup?invite=…` + Copy.  
4. Pending invites → **Revoke**.

**Errores:** invite activo duplicado; non-owner no puede mutar.

---

## 22. Billing + cuotas AI `/dashboard/billing`

### 22.1 Qué ves

- Plan actual.  
- **AI runtime** (live/demo).  
- **Monthly tokens:** usados / presupuesto (`YYYY-MM`).  
- Trial ≈ 50 000 · Active ≈ 500 000.  
- Over quota → soft fallback a demo (no apaga el SaaS).

### 22.2 Acciones owner

| Acción | Condición |
|--------|-----------|
| Upgrade Stripe Checkout | Stripe configurado |
| Customer Portal | Existe `stripe_customer_id` |
| Activate Pro (dev) | Solo no-producción / bypass |

### 22.3 Tras Checkout

- Success URL puede traer `session_id` → sync inmediato.  
- Webhook Stripe confirma `plan_status=active` / `past_due` / `canceled`.

---

## 23. Cron tick (automatización de fondo)

**Endpoint:** `GET|POST /api/cron/tick`  
**Auth:** `Authorization: Bearer $CRON_SECRET` (o header `x-cron-secret`)  
**Rate limit:** ~30 req/min por IP (in-memory).

### 23.1 Qué hace en orden

1. **Reaper** — RPC `reap_stuck_running_executions(15)`: marca `failed` ejecuciones `running` > 15 min (timeout Vercel / worker colgado).  
2. **Resume delays (claim atómico)** — RPC `claim_due_delay_executions` (`FOR UPDATE SKIP LOCKED` → `status=running`) y luego resume. Evita emails/Slack/LLM duplicados si el cron se solapa.  
3. **Email auto-sync** — mailboxes `active` + `auto_sync` + workflow (hasta 20; ~10 mails c/u).  
4. **Schedules (claim atómico)** — RPC `claim_due_schedules` actualiza `last_scheduled_at` antes de arrancar el run.

Devuelve JSON: `{ resumedDelays, emailSynced, scheduledRuns, reapedStuck, errors[] }`.

### 23.2 Cómo programarlo

Vercel Hobby **no** permite cron cada 5 min. Usa cron externo (cron-job.org) cada 5 minutos pegando esa URL con el secret.

Middleware marca `/api/cron` y `/api/email` como públicos (no redirigen a login).

### 23.3 Fuente de verdad del schema

Las migraciones versionadas viven en `supabase/migrations/`. Los `scripts/prod-migration-*.sql` son **copias** para el SQL Editor de Cloud cuando no puedes hacer `db push` — no edites producción a mano sin reflejar el cambio en `supabase/migrations/`.

## 24. Webhooks: email inbound + Stripe

### 24.1 Email inbound `POST /api/email/inbound`

Body JSON:

```json
{
  "token": "<inbound_token de la conexión>",
  "from": "cliente@x.com",
  "subject": "...",
  "body": "...",
  "to": "opcional",
  "threadId": "opcional"
}
```

Header opcional: `x-ionex-email-secret: $EMAIL_INBOUND_SECRET`.  
**Rate limit:** ~60/min por IP y ~40/min por `token` (evita quemar cuota de IA con un token filtrado).

Efecto: insert mensaje + `startWorkflowRun` como el sync IMAP.

### 24.2 Stripe `POST /api/stripe/webhook`

- Verifica firma.  
- Eventos: checkout completed, invoice.paid, subscription updated/deleted.  
- Actualiza `organizations.plan_status` y ids Stripe.

---

## 25. Inteligencia artificial (LLM) al detalle

### 25.1 Resolución de provider

1. `IONEX_AI_PROVIDER=demo` → demo.  
2. Preferencia anthropic/openai si hay key.  
3. Si hay `OPENAI_API_KEY` → OpenAI.  
4. Else Anthropic.  
5. Else demo.

### 25.2 Cuotas

| Plan | Tokens / mes UTC |
|------|------------------|
| trial | 50 000 |
| active | 500 000 |
| otros | 0 (producto locked) |

Contadores en `organizations.ai_tokens_used_month` + `ai_usage_month`.  
Eventos en `ai_usage_events`.

### 25.3 429 / quota API

Agent/Classifier/Lab: catch → **demo + notice** en logs/UI.  
Assistant: guía local de fallback.

### 25.4 Dónde se llama LLM

- Nodos agent / classifier  
- AI Lab  
- Assistant chat  

### 25.5 Streaming

Hoy **no** hay streaming token-a-token en el canvas: el output aparece al terminar el paso. Queda como mejora futura.

---

## 26. Tablas de base de datos

| Tabla | Qué guarda |
|-------|------------|
| `organizations` | Tenant, plan, Stripe, contadores AI |
| `profiles` | Usuario↔org, role, nombre |
| `workflows` | Grafo JSON, active, schedule_* |
| `workflow_executions` | Corridas, logs, resume_at, waiting_node_id |
| `approvals` | HITL pending/approved/rejected + payload |
| `notifications` | Inbox in-app |
| `email_connections` | IMAP/SMTP, token inbound, auto_sync |
| `email_messages` | Auditoría mails + link a execution |
| `invites` | Invitaciones con token y expiry |
| `ai_usage_events` | Cada call LLM con tokens |

Enums relevantes: `plan_status`, `user_role`, `execution_status`, `approval_status`, providers email, etc.

Migraciones en `supabase/migrations/` (orden cronológico). Scripts sueltos para SQL Editor Cloud: `scripts/prod-migration-*.sql`.

---

## 27. Rutas feliz recomendadas (casos de uso)

### 27.1 Agencia de contenido (primer día)

1. Signup owner.  
2. Automations → **Content marketing**.  
3. En canvas, lee el grafo Research → Draft → Approval.  
4. Brief real en trigger → Save → Run.  
5. Executions: mira outputs.  
6. Approvals: Approve.  
7. (Opcional) añade Slack/Webhook post-approval con plantilla Content publish.

### 27.2 Soporte con mailbox

1. Integrations → conecta Gmail (app password).  
2. Default workflow = plantilla Support email.  
3. Sync now (o espera cron + auto_sync).  
4. Classifier decide FAQ vs sensible.  
5. Auto-reply o Approval + forward.

### 27.3 Equipo

1. Team → invite copywriter (`member`).  
2. Él entra con el link.  
3. Él corre workflows; tú (owner) apruebas y gestionas billing.

### 27.4 Delay SLA

Agent → Delay 60 → Approval → Email send.  
Útil para “esperar ventana de negocio” antes de notificar.

---

## 28. Errores frecuentes y qué hacer

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| Localhost no carga auth | Docker off | Encender Docker + `supabase start` |
| Google `redirect_uri_mismatch` | URI Cloud incompleta | Añadir callback de Supabase en Google |
| Invite falla | Email distinto | Usar exactamente el email invitado |
| Plan trial eterno tras pagar | Webhook Stripe | Configurar `STRIPE_WEBHOOK_SECRET` + endpoint |
| Demo en prod | Falta OpenAI en Vercel | Añadir `OPENAI_API_KEY` + redeploy |
| Schedule/delay no avanzan | No hay cron | Pegar `/api/cron/tick` cada 5m con secret |
| Sync IMAP error | App password / IMAP off | Revisar preset Gmail/Outlook |
| Classifier failed “No edge” | Falta arista de ruta | Conectar handle de esa route |
| Paywall | `past_due`/`canceled` | Billing / Stripe |
| Cuota AI | Tokens del mes agotados | Upgrade o esperar mes; soft demo |

---

## 29. Checklist go-live

- [ ] Signup + login en https://ionexflow.vercel.app  
- [ ] Migraciones Cloud (init + notifications + email + team + ai usage + **hardening claim/versions**) ✅ aplicar `scripts/prod-migration-hardening.sql`  
- [ ] `EMAIL_CREDENTIALS_ENCRYPTION_KEY` en Vercel (producción)  
- [ ] Auth Site URL + Redirect URLs  
- [ ] Google OAuth (opcional)  
- [ ] `OPENAI_API_KEY` en Vercel  
- [ ] `CRON_SECRET` + cron externo  
- [ ] Team invite smoke test  
- [ ] Test run (safe) + Run live consciente  
- [ ] Restore de una versión de workflow  
- [ ] Run workflow + Approval  
- [ ] Mailbox + Sync (**reconectar** mailboxes tras cifrado)  
- [ ] Stripe + webhook (si cobras)  
- [ ] Billing muestra tokens  

---

## 30. Qué aún no hace el producto

- Streaming en canvas  
- Multi-org por usuario / SSO  
- Colas tipo Inngest (hoy: request sync + cron con claim atómico)  
- OAuth nativo Gmail/Microsoft Graph (hoy: app password cifrado)  
- OAuth nativo LinkedIn/Buffer  
- Expo push  
- Fan-out completo con join arbitrario (hoy: paralelo de nodos outbound hermanos)  
- Stripe metered price automático por overage (hoy: sigue live + contabiliza `ai_overage_tokens`)  
- Marketplace multi-LLM  

### Ya cubierto (valor de negocio reciente)

- Versionado + restore de workflows  
- Test run / Safe mode  
- Aprobación editable  
- Slack Approve/Reject (links firmados en webhook)  
- SLA de approvals (cron escalate)  
- Analytics `/dashboard/analytics`  
- Audit log `/dashboard/audit`  
- Nodo Condition determinista  
- Cifrado de passwords de mailbox  
- Overage: no apaga a demo por defecto  

---

## 31. Mapa de archivos en el código

| Pieza | Ruta |
|-------|------|
| Middleware público | `apps/web/lib/supabase/middleware.ts` |
| Auth actions | `apps/web/actions/auth.ts` |
| Team | `apps/web/actions/team.ts`, `app/dashboard/team` |
| Email | `apps/web/actions/email.ts`, `lib/email/*` |
| Workflows | `apps/web/actions/workflows.ts` |
| Executions start | `apps/web/actions/executions.ts` |
| Runner | `apps/web/lib/engine/runner.ts` |
| Persist / start / resume | `lib/engine/persist-result.ts`, `start-run.ts`, `approvals.ts` |
| LLM | `lib/ai/provider.ts`, `quotas.ts`, `usage.ts`, `modes.ts`, `assistant.ts` |
| Templates | `lib/workflow/templates.ts` |
| Canvas | `components/workflow/workflow-canvas.tsx` |
| Cron | `app/api/cron/tick/route.ts` |
| Inbound email | `app/api/email/inbound/route.ts` |
| Stripe webhook | `app/api/stripe/webhook/route.ts` |
| Deploy | `docs/DEPLOY.md` |
| Migraciones | `supabase/migrations/*.sql` |

---

*Fin del manual exhaustivo. Si añades un feature nuevo, actualiza primero este archivo y luego ESTADO-FUNCIONAL.*
