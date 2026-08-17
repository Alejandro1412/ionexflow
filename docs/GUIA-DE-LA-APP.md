# IonexFlow — Guía de la aplicación

Documento de producto: **qué es**, **qué puedes hacer hoy**, **qué falta**, **cómo usarla** y **un ejemplo real de negocio**.

> Estado: **Fases 1–5 implementadas** (auth, billing, canvas, motor, móvil)  
> Repo: [github.com/Alejandro1412/ionexflow](https://github.com/Alejandro1412/ionexflow)  
> Companion: [Estado funcional](./ESTADO-FUNCIONAL.md)

---

## 1. ¿Qué es IonexFlow?

**IonexFlow** es un SaaS B2B: un *command center* para diseñar, ejecutar y supervisar **flujos de trabajo con agentes de IA**, con **aprobación humana** (web + móvil) y **cobro por plan**.

Sirve para equipos que necesitan:

1. **Diseñar** un proceso visual (quién hace qué, en qué orden).
2. **Ejecutar** ese proceso (hoy con agentes *simulados*; ver sección 5).
3. **Pausar** en pasos críticos hasta que una persona apruebe o rechace.
4. **Monitorear** logs y estado de cada corrida.
5. **Cobrar** (trial → Stripe, o “Activate Pro” en local).

Piensa en un “tablero de control” de operaciones automatizadas: no sustituye a Slack ni a un CRM; **orquesta** pasos automáticos y humanos en una sola línea de trabajo.

---

## 2. Resumen: qué HAY vs qué FALTA

### Hay (usable hoy en local)

| Área | Qué incluye |
|------|-------------|
| **Auth** | Signup/login email+password; org + profile automáticos; sesión protegida en `/dashboard` |
| **Google OAuth** | Cableado (Supabase + botón); requiere claves Google y flag |
| **Dashboard** | Overview con conteos, nav (Workflows, Executions, Approvals, Billing) |
| **Workflows** | CRUD, editor React Flow, guardar, ejecutar |
| **Motor** | Recorre Start → Agent → Approval → End; pausa y reanuda |
| **Approvals** | Inbox web; Approve/Reject; resume de la ejecución |
| **Billing** | Pricing; paywall si el plan no es trial/active; Stripe o Activate Pro (dev) |
| **Móvil** | Login + inbox Realtime de approvals pendientes |
| **SEO / perf** | Metadata, robots, sitemap, OG; Three.js solo en landing/auth; canvas lazy |

### Falta / limitaciones importantes

| Hueco | Detalle |
|-------|---------|
| **Agentes ≠ LLM real** | El nodo *Agent* **no llama** a OpenAI/Anthropic. Escribe un log simulado con el prompt. Es la base del producto, no la inteligencia final. |
| **Grafos lineales** | Solo se sigue la **primera** arista saliente. No hay ramas if/else ni paralelismo. |
| **Tipos de nodo** | Solo `start`, `agent`, `approval`, `end`. |
| **Stripe producción** | Sin claves Stripe no hay Checkout real (usa Activate Pro en local). |
| **Google OAuth** | Sin Client ID/Secret + redirect en Google Cloud no entra. |
| **Móvil** | No hay signup, editor de workflows, billing ni Google en la app. |
| **Multi-miembro** | El modelo tiene `owner`/`member`, pero la UI no invita usuarios aún. |
| **`packages/ui`** | Vacío; la UI vive en `apps/web/components/ui`. |
| **Producción cloud** | Documentado para local; deploy (Vercel + Supabase cloud) no está guiado aquí. |

---

## 3. Qué puedes hacer en la app (paso a paso)

Requisitos: Docker, Supabase local, `pnpm dev:web` → [http://localhost:3000](http://localhost:3000).

### 3.1 Landing (`/`)

- Marca IonexFlow + escena 3D (red neural + núcleo).
- CTAs a signup / login.
- La escena **no** corre en el dashboard (mejor rendimiento).

### 3.2 Crear cuenta (`/signup`)

Campos: nombre, nombre de organización, email, password (≥ 8).

Al crear cuenta, automáticamente:

1. Usuario en Supabase Auth.
2. Organización en plan **`trial`**.
3. Perfil como **`owner`**.
4. Redirección al dashboard.

### 3.3 Login (`/login`)

Email/password. Si ya hay sesión, middleware te manda al dashboard.

**Google:** solo si configuraste OAuth (ver [ESTADO-FUNCIONAL](./ESTADO-FUNCIONAL.md)).

### 3.4 Overview (`/dashboard`)

- Saludo y datos de la org (nombre, plan, rol).
- Conteos: workflows, ejecuciones, approvals pendientes.
- Atajos a workflows, approvals y billing.

### 3.5 Workflows (`/dashboard/workflows`)

- Listar y crear workflows.
- Abrir el editor (`/dashboard/workflows/[id]`):
  - Añadir nodos (Start, Agent, Approval, End).
  - Conectar, editar labels/prompts/mensajes.
  - **Save** y **Run**.

Plantilla por defecto: **Start → Research agent → Human approval → End**.

### 3.6 Ejecuciones (`/dashboard/executions`)

- Lista de corridas (estado: running, paused, completed, failed).
- Detalle con **logs** de cada paso.

Al pulsar **Run**, si hay un nodo Approval, la ejecución queda **`paused`** hasta que alguien decida.

### 3.7 Approvals (`/dashboard/approvals`)

- Inbox de pendientes.
- **Approve** → el motor continúa hasta End (o siguiente nodo).
- **Reject** → la ejecución falla / se cierra según la lógica del resolver.

Misma API usada por el móvil: `POST /api/approvals/resolve`.

### 3.8 Billing y Pricing

- `/pricing` — planes (marketing).
- `/dashboard/billing` — Checkout Stripe **o** **Activate Pro (dev)** si no hay claves.
- Si el plan no es `trial`/`active`, el producto bloquea features (paywall).

### 3.9 App móvil (`apps/mobile`)

1. Login email/password (mismas credenciales Supabase).
2. Lista de approvals pendientes (Realtime).
3. Approve / Reject llamando a la API de la web.

En dispositivo físico: `EXPO_PUBLIC_API_URL` debe ser la **IP LAN** del PC, no `localhost`.

---

## 4. Mapa de pantallas

| URL | Acceso | Función |
|-----|--------|---------|
| `/` | Público | Landing + 3D |
| `/pricing` | Público | Precios |
| `/signup` / `/login` | Público | Cuenta |
| `/auth/callback` | Sistema | OAuth |
| `/dashboard` | Autenticado | Overview |
| `/dashboard/workflows` | Autenticado | Lista |
| `/dashboard/workflows/[id]` | Autenticado | Editor + Run |
| `/dashboard/executions` | Autenticado | Historial |
| `/dashboard/executions/[id]` | Autenticado | Logs |
| `/dashboard/approvals` | Autenticado | Inbox humano |
| `/dashboard/billing` | Autenticado | Plan / Stripe |

---

## 5. Motor y tipos de nodo (importante)

| Nodo | Qué hace hoy |
|------|----------------|
| **Start** | Arranca; registra el trigger en logs. |
| **Agent** | Simula trabajo: log del tipo “analizó payload con prompt X”. **Sin LLM.** |
| **Approval** | Crea fila en `approvals`, pausa la ejecución. |
| **End** | Marca la corrida como `completed`. |

Límites del motor:

- Máximo ~100 visitas a nodos (anti-bucles).
- Debe existir Start y End.
- Una sola arista saliente efectiva por nodo.

Cuando conectes un LLM real, el cambio natural es reemplazar el cuerpo del nodo **Agent** en `apps/web/lib/engine/runner.ts` por una llamada a tu proveedor, manteniendo el resto del orquestador.

---

## 6. Modelo de datos (resumen)

| Tabla | Rol |
|-------|-----|
| `organizations` | Tenant + `plan_status` + IDs Stripe |
| `profiles` | Usuario ↔ org + rol |
| `workflows` | Grafo JSON (`nodes` / `edges`) |
| `workflow_executions` | Cada corrida + logs + status |
| `approvals` | Decisiones humanas por nodo |

Todo filtrado por **RLS** a tu organización.

---

## 7. Ejemplo real: qué podrías hacer con IonexFlow

### Escenario: agencia de contenido / marketing

**Empresa:** “Norte Digital”, 8 personas. Publican posts y creatividades para clientes. Antes de publicar algo sensible (marca, claims legales, precio), un **director de cuenta** debe aprobar.

### Flujo que diseñarían en el canvas

```
Start
  → Agent “Brief research”
       (prompt: resume brief del cliente + tono de marca)
  → Agent “Draft copy”
       (prompt: genera 3 variantes de copy para LinkedIn)
  → Approval “Director de cuenta”
       (mensaje: “Revisa copy y claims antes de publicar”)
  → Agent “Schedule publish”
       (prompt: prepara payload para Buffer/Hootsuite)
  → End
```

### Qué pasa en la práctica (hoy vs mañana)

| Paso | Hoy en IonexFlow | Con LLM + integraciones (futuro) |
|------|------------------|-----------------------------------|
| Research / Draft | Logs simulados con el prompt | GPT/Claude generan texto real |
| Approval | Pausan la corrida; el director aprueba en **web o móvil** en el metro | Igual — esa parte **ya está** |
| Publish | Log simulado | Webhook a Buffer, Notion, Slack |
| Billing | Trial / Activate Pro / Stripe | Mismo modelo SaaS por sede |

### Por qué tiene sentido el producto

- El valor no es “otro chat GPT”: es **proceso + control**.
- Compliance y marca: nada sale sin **Approval**.
- El móvil cierra el loop: el director no necesita abrir el laptop.
- Cada corrida deja **auditoría** (executions + logs).

Otros ejemplos del mismo patrón:

- **Soporte:** Agent resume ticket → Approval supervisor → Agent responde.
- **Ventas:** Agent califica lead → Approval AE → Agent crea oportunidad en CRM.
- **Ops / finanzas:** Agent arma reporte de gastos → Approval CFO → End.

---

## 8. Cómo arrancar (local)

```bash
cd ionexflow
pnpm install
npx supabase start
# Copia URL + anon + service_role de `npx supabase status` → apps/web/.env.local
pnpm dev:web
```

| Servicio | URL |
|----------|-----|
| Web | http://localhost:3000 |
| Supabase Studio | http://127.0.0.1:54323 |
| API | http://127.0.0.1:54321 |

Opcional móvil:

```bash
cp apps/mobile/.env.example apps/mobile/.env
pnpm dev:mobile
```

Smoke automatizado: `node scripts/smoke-e2e.mjs`

Google OAuth local: ver `scripts/restart-supabase-google.ps1` y [ESTADO-FUNCIONAL](./ESTADO-FUNCIONAL.md).

---

## 9. Arquitectura del monorepo

```
ionexflow/
├── apps/web/          Next.js — command center
├── apps/mobile/       Expo — approvals companion
├── packages/config/   TS / ESLint compartidos
├── packages/ui/       (placeholder)
├── supabase/          Migraciones, RLS, Realtime
├── scripts/           Smoke E2E, reinicio Google OAuth
└── docs/              Esta guía + estado funcional
```

| Capa | Stack |
|------|--------|
| Web | Next.js 14, React 18, Tailwind, React Flow |
| Auth/DB | Supabase Auth + Postgres + RLS + Realtime |
| 3D (marketing) | Three.js / R3F (solo landing y auth) |
| Billing | Stripe (opcional) |
| Móvil | Expo Router |

---

## 10. En una frase

**IonexFlow** es la plataforma para diseñar y supervisar flujos de agentes con **pausas humanas** y cobro B2B; **hoy** ya puedes registrarte, dibujar un workflow, ejecutarlo, aprobarlo en web/móvil y gestionar el plan — con agentes aún **simulados** listos para enchufar un LLM real.
