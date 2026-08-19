# IonexFlow — Guía completa del producto

Documento oficial: **para qué es**, **qué se puede hacer hoy**, **cómo lo usa una empresa** y **qué falta**.

> **Manual paso a paso al máximo detalle:** [MANUAL-COMPLETO.md](./MANUAL-COMPLETO.md)  
> Repo: [github.com/Alejandro1412/ionexflow](https://github.com/Alejandro1412/ionexflow)  
> Ver también: [Estado funcional](./ESTADO-FUNCIONAL.md) · [Plan siguiente](./PLAN-SIGUIENTE.md) · [Deploy](./DEPLOY.md)

---

## 1. ¿Para qué es esta app?

**IonexFlow** es un *command center* B2B: una plataforma donde las empresas **diseñan, ejecutan y controlan procesos automatizados con IA**, sin soltar el control humano en los pasos críticos.

### El problema que resuelve

Las empresas ya usan ChatGPT suelto. Eso genera:

- Trabajo inconsistente (cada persona pide cosas distinto).
- Riesgo de marca/legal (se publica sin revisión).
- Cero auditoría (¿quién generó qué y quién aprobó?).
- Procesos que no se repiten igual mañana.

IonexFlow convierte eso en un **procedimiento visual reutilizable**:

```
Brief / ticket / lead
    → Agente(s) de IA
    → (opcional) Classifier que elige camino
    → Approval humano
    → Fin + historial
```

### Para quién

| Perfil | Uso típico |
|--------|------------|
| Agencias de marketing | Research + copy + aprobación del director |
| Soporte / CS | Triage de tickets + respuesta asistida |
| Ventas | Calificar leads + outreach + OK del AE |
| Ops | Notas → playbook / checklist aprobable |
| Founders / ops leads | Estandarizar “cómo trabajamos con IA” en la org |

### Qué NO es

- No es un CRM, ni Slack, ni Buffer.
- No sustituye LinkedIn: **orquesta** el trabajo hasta la decisión humana; la publicación externa aún puede ser manual.
- No es solo un chatbot: el chat (**Ionex Assistant**) guía; el valor está en **Workflows + Automations + Approvals**.

---

## 2. Mapa mental del producto

```
                    ┌─────────────────────┐
                    │   Ionex Assistant   │  ← explica y guía
                    └──────────┬──────────┘
                               │
┌──────────────┐    ┌──────────▼──────────┐    ┌──────────────┐
│ AI Automations│───▶│     Workflows      │───▶│  Executions  │
│  (plantillas) │    │  (canvas + Run)    │    │  (auditoría) │
└──────────────┘    └──────────┬──────────┘    └──────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     Approvals       │  ← humano decide
                    │   (web + móvil)     │
                    └─────────────────────┘
```

| Pieza | Pregunta que responde |
|-------|------------------------|
| **AI Automations** | “¿Por dónde empiezo sin diseñar desde cero?” |
| **Workflows** | “¿Cómo está definido y cómo lo corro mi proceso?” |
| **Executions** | “¿Qué pasó en cada corrida?” |
| **Approvals** | “¿Quién tiene que decir sí/no ahora?” |
| **Assistant** | “Explícame la app / ayúdame a decidir” |
| **Billing** | “¿Tenemos acceso de producto / plan?” |

---

## 3. Qué se puede hacer HOY (minucioso)

Requisitos locales: Docker, Supabase (`npx supabase start`), `pnpm dev:web` → http://localhost:3000  
LLM live: `OPENAI_API_KEY` o `ANTHROPIC_API_KEY` en `apps/web/.env.local` (si no hay cuota, hay demo intelligence / fallback del assistant).

### 3.1 Cuenta y organización

- **Signup**: nombre, org, email, password → crea usuario + organización `trial` + perfil `owner`.
- **Login** email/password.
- **Google OAuth** (opcional, requiere config en Google Cloud + Supabase).
- Middleware protege `/dashboard/*`.
- Multi-tenant con **RLS** (cada org solo ve sus datos).

### 3.2 Overview (`/dashboard`)

- Saludo y datos de org (nombre, plan, rol).
- Conteos: workflows, executions, approvals pendientes.
- Atajos a Automations, Workflows, Approvals, Billing.

### 3.3 AI Automations (`/dashboard/automations`)

Hub de automatización:

1. **Plantillas de proceso** (un clic crea el workflow completo):
   - **Content marketing** — Research → Draft → Director approval.
   - **Content + publish hooks** — igual + Slack + webhook outbound tras aprobar.
   - **Draft + rewrite** — redacta y luego un “editor” IA reescribe.
   - **Support triage** — Classifier (`needs_human` / `auto_reply`) + agents + approval.
   - **Sales lead qualify** — research → score hot/warm → approval si hot → outreach.
   - **Ops playbook** — extract facts → playbook → approval ops.
2. **Playbooks de Agent**: general, research, draft, rewrite, extract, support, sales, ops (cada uno cambia system prompt + estilo).
3. **AI Lab**: prueba un playbook al instante sin armar el canvas.

### 3.4 Workflows (`/dashboard/workflows` y canvas)

Es el **taller del proceso**:

- Listar / crear / borrar workflows.
- Editor React Flow:
  - Añadir **Agent**, **Classifier**, **Approval**, **HTTP**, **Slack**, **Webhook**.
  - Conectar nodos (en Classifier, cada handle = una ruta).
  - Inspector: label, playbook, model, temperature, system/task prompt, routes, message de approval, URL/headers/body de integraciones.
  - **Save** / **Run**.
  - Campo **Run trigger / brief**: el input de negocio de esa corrida.
- Banner de estado LLM (OpenAI live / Anthropic / demo).

**Nodos del motor**

| Nodo | Qué hace |
|------|----------|
| **Start** | Registra el trigger y arranca. |
| **Agent** | Llama al LLM (o demo) con playbook; guarda output Markdown; pasa contexto al siguiente. |
| **Classifier** | Pide al LLM una sola ruta (`hot`, `needs_human`…); elige la arista con ese label/handle. |
| **Approval** | Pausa; crea fila en `approvals` + notificación in-app (email si Resend). |
| **HTTP** | `fetch` genérico (método, headers JSON, body con plantillas). |
| **Slack** | Incoming Webhook: envía `{{agentOutput}}` como mensaje. |
| **Webhook** | POST JSON a Buffer/Zapier/Make/tu API. |
| **End** | Marca la ejecución `completed`. |

Plantillas de body: `{{agentOutput}}`, `{{trigger}}`, `{{label}}`, `{{context.NombreNodo}}`.

### 3.5 Executions

- Lista de corridas y estados: `running`, `paused`, `completed`, `failed`.
- Detalle: timeline + **Agent intelligence** + **Integrations** (respuestas HTTP) + approvals pendientes.

### 3.6 Approvals (web + móvil)

- Inbox de pendientes con el **texto generado por la IA**.
- **Approve** → el motor reanuda (puede disparar Slack/Webhook si van después).
- **Reject** → la ejecución falla.
- Móvil (Expo): login + lista Realtime + resolve vía `POST /api/approvals/resolve`.

### 3.7 Notifications

- Campana en el header del dashboard (badge de no leídas).
- Página `/dashboard/notifications`.
- Al crear un Approval: notificación in-app a todos los perfiles de la org.
- Email opcional con `RESEND_API_KEY` (+ `RESEND_FROM`).

### 3.8 Ionex Assistant (chatbot)

- Widget **Ask Ionex** en el dashboard + página `/dashboard/assistant`.
- Conoce al usuario (nombre, org, rol, plan).
- Explica la app, guía pasos, charla (saludos, “¿cómo estás?”) y hace preguntas de seguimiento.
- Si OpenAI da 429/sin cuota: **sigue conversando** en modo guía (no rompe el chat).
- Con API key y cuota: respuestas LLM live.

### 3.9 Billing y Pricing

- `/pricing` marketing.
- `/dashboard/billing`: Stripe Checkout si hay keys; si no, **Activate Pro (dev)**.
- Paywall si el plan no es `trial` / `active`.

### 3.10 Experiencia / calidad técnica (ya hecha)

- SEO: metadata, robots, sitemap, favicon.
- Perf: Three.js solo en landing/auth; Turbopack en dev; canvas lazy; prefetch de nav desactivado.
- Escena 3D de marca en marketing.

---

## 4. Cómo una empresa de marketing lo usa de punta a punta

### Su proceso manual típico

1. Llega un brief del cliente.  
2. Alguien investiga tono/audiencia.  
3. Alguien redacta copy.  
4. El director aprueba.  
5. Alguien publica en LinkedIn.

### Mapeo a IonexFlow (hoy)

| Paso de la empresa | En la app |
|--------------------|-----------|
| 1. Brief | Texto del **Run trigger** |
| 2. Research | Agent playbook **research** |
| 3. Copy | Agent playbook **draft** |
| 4. OK director | Nodo **Approval** → Approvals |
| 5. Publicar | Nodo **Slack** / **Webhook** / **HTTP** (o manual) |

### Pasos exactos en la UI

1. Signup / login.  
2. **AI Automations** → **Content + publish hooks** (o Content marketing).  
3. En el canvas, pegar tu Slack Incoming Webhook / URL de Zapier.  
4. Pegar el brief real → **Run**.  
5. El director ve la **campana** / **Approvals**, lee el draft, **Approve**.  
6. Tras Approve, Slack/Webhook disparan solos.  
7. Revisar **Executions** (Agent + Integrations).

---

## 5. Qué falta para ser una app PRO usable por empresas de verdad

Hoy es un **producto usable en local / demo avanzada**. Para que una empresa lo adopte en producción como herramienta diaria, falta cerrar estos bloques:

### A. Producción y dinero (bloqueante comercial)

| Falta | Por qué importa |
|-------|-----------------|
| Deploy cloud (Vercel + Supabase Cloud) | El cliente no usará tu laptop. |
| Guía `DEPLOY.md` + secrets de prod | Onboarding del equipo técnico. |
| Stripe real (Checkout + webhook + portal) | Cobrar suscripciones. |
| Dominio + HTTPS + OAuth Google de prod | Login corporativo serio. |
| Desactivar bypass “Activate Pro (dev)” en prod | Seguridad de billing. |

### B. Colaboración de equipo (bloqueante B2B)

| Falta | Por qué importa |
|-------|-----------------|
| Invitar miembros (email, rol owner/member) | El copywriter diseña; el director solo aprueba. |
| Permisos por rol en UI | Billing solo owner; approvals para members. |
| Expo push al móvil | Complemento a la campana web + email Resend (ya hechos). |

### C. Integraciones y cierre del proceso (valor “pro”)

| Estado / falta | Por qué importa |
|----------------|-----------------|
| **Hecho:** nodos HTTP / Slack / Webhook | Cierra el proceso hacia Slack, Zapier, Make, Buffer via webhook. |
| Conectores OAuth nativos (LinkedIn, Buffer app) | Menos fricción que pegar URLs de webhook. |
| Colas / jobs en background | Corridas largas sin bloquear el request HTTP. |
| Reintentos y manejo de fallos LLM | Cuotas 429, timeouts, degradación elegante en Agents (el Assistant ya tiene fallback). |

### D. Orquestación avanzada

| Falta | Por qué importa |
|-------|-----------------|
| Paralelismo (varios agents a la vez + join) | Procesos reales más ricos. |
| Condiciones no-LLM (if field X) | Reglas deterministas baratas. |
| Variables / memoria de corrida tipada | Menos “solo Markdown libre”. |
| Versionado de workflows | No romper procesos en producción. |
| Scheduling (cron) | Corridas diarias sin clic manual. |

### E. Cumplimiento, coste y confianza

| Falta | Por qué importa |
|-------|-----------------|
| Límites de tokens / cuota por plan | Controlar coste OpenAI. |
| Audit export (CSV/PDF) | Compliance y clientes enterprise. |
| SSO (SAML/OIDC) | Empresas grandes. |
| Entornos staging/prod | Cambios seguros. |
| SLA, backups, monitoring | Operación serio. |

### F. Móvil y UX

| Falta | Por qué importa |
|-------|-----------------|
| Push notifications | Approvals en el momento. |
| Ver output completo y deep links | Mejor experiencia del aprobador. |
| No hace falta editor de workflows en móvil | El valor móvil es aprobar, no diseñar. |

---

## 6. Matriz rápida: ¿ya sirve / aún no?

| Necesidad de la empresa | ¿Hoy? |
|-------------------------|--------|
| Estandarizar research + draft + aprobación | **Sí** |
| Auditoría de corridas | **Sí** |
| Approvals en web (y móvil con setup) | **Sí** |
| Plantillas por industria | **Sí** |
| Chat guía personalizado | **Sí** |
| Notificar al director al instante | **Sí** (campana + email Resend opcional) |
| Publicar vía Slack / webhook | **Sí** |
| App en internet con cobro real | **No** (deploy + Stripe prod) |
| Varios usuarios en la misma org con roles | **No (UI)** |
| Push móvil Expo | **No** |

---

## 7. Arranque local (resumen)

```bash
cd ionexflow
pnpm install
npx supabase start
# Copiar URL + anon + service_role → apps/web/.env.local
# Opcional: OPENAI_API_KEY=...
pnpm dev:web
```

| URL | Uso |
|-----|-----|
| http://localhost:3000 | App web |
| http://127.0.0.1:54323 | Supabase Studio |

Smoke: `node scripts/smoke-e2e.mjs`

---

## 8. En una frase

**IonexFlow** sirve para que una empresa **convierta su proceso con IA en un flujo visual controlado** (agents + approvals + historial).  
**Hoy** eso ya se puede demostrar y operar en local, con notificaciones y publicación vía Slack/Webhook.  
**Para ser pro de verdad** faltan: **nube + Stripe, equipo multi-usuario, push móvil y OAuth nativo**.
