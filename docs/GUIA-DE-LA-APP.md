# IonexFlow — Guía de la aplicación

Documento paso a paso: **para qué sirve**, **qué puedes hacer hoy** y **cómo funciona por dentro**.

> Estado actual: **Fase 1**  
> Repo: [github.com/Alejandro1412/ionexflow](https://github.com/Alejandro1412/ionexflow)

---

## 1. ¿Para qué es IonexFlow?

**IonexFlow** es un SaaS B2B pensado para empresas que quieren:

1. **Diseñar** flujos de trabajo con agentes de IA (de forma visual).
2. **Orquestar** esos agentes (quién hace qué, en qué orden).
3. **Monitorear** ejecuciones en tiempo real.
4. **Aprobar o rechazar** pasos críticos desde el móvil (human-in-the-loop).
5. **Cobrar** por plan (trial → suscripción Stripe).

En resumen: es el **command center** (centro de mando) de agentes autónomos, con control humano y listo para monetizar.

Hoy (Fase 1) ya tienes la **cáscara del producto**: identidad, autenticación, multi-tenant (organizaciones), seguridad por filas (RLS) y una UI inmersiva. El canvas visual, el motor de ejecución, el cobro y la app móvil de aprobaciones llegan en fases siguientes.

---

## 2. ¿Qué puedes hacer HOY? (paso a paso)

Asegúrate de tener corriendo:

- Docker Desktop
- Supabase local (`pnpm supabase:start` o `npx supabase start`)
- La web (`pnpm dev:web`) → normalmente [http://localhost:3000](http://localhost:3000)

### Paso A — Ver la landing

1. Abre [http://localhost:3000](http://localhost:3000).
2. Verás la marca **IonexFlow**, un fondo 3D (red neural + núcleo orbital) y botones para registrarte o entrar.
3. Mueve el mouse: la cámara y el núcleo reaccionan.
4. Haz scroll: la escena “entra” más hacia el núcleo.

**Para qué sirve:** presentar el producto y llevarte al registro o login.

---

### Paso B — Crear una cuenta (signup)

1. Ve a [http://localhost:3000/signup](http://localhost:3000/signup) o pulsa **Get started / Start free trial**.
2. Completa:
   - **Full name** — tu nombre
   - **Organization name** — nombre de tu empresa/equipo
   - **Work email** — correo
   - **Password** — mínimo 8 caracteres
3. Pulsa **Create account**.

**Qué ocurre por detrás (automático):**

1. Supabase Auth crea el usuario en `auth.users`.
2. Un trigger SQL (`handle_new_user`) crea:
   - una fila en **`organizations`** (tu empresa, plan `trial`);
   - una fila en **`profiles`** (tú como **owner** de esa org).
3. Quedas con sesión iniciada y te redirige al **dashboard**.

No tienes que crear la organización a mano: el signup la provisiona.

---

### Paso C — Iniciar sesión (login)

1. Ve a [http://localhost:3000/login](http://localhost:3000/login).
2. Introduce email y password.
3. Si son correctos → `/dashboard`.
4. Si fallan → mensaje de error en el formulario.

Si ya tienes sesión y visitas `/login` o `/signup`, el middleware te manda al dashboard.

---

### Paso D — Google OAuth (opcional)

En la pantalla de login/signup hay un botón de Google.

**Solo funciona si configuraste:**

- `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET` antes de arrancar Supabase
- En Google Cloud, el redirect: `http://localhost:3000/auth/callback`

Si no está configurado, el botón puede fallar. El flujo email/password sí funciona sin Google.

---

### Paso E — Usar el dashboard

1. Entra a [http://localhost:3000/dashboard](http://localhost:3000/dashboard) (requiere login).
2. Verás:
   - Saludo con tu nombre
   - Tarjeta **Organization** con:
     - nombre de la org
     - **plan status** (ahora `trial`)
     - tu **rol** (`owner`)
3. Botón **Sign out** para cerrar sesión → vuelves a `/login`.

**Para qué sirve hoy:** confirmar que tu cuenta, org y permisos están bien.  
**Qué no hace aún:** no hay canvas de workflows ni ejecuciones; es un placeholder de Fase 1.

---

### Paso F — Explorar Supabase Studio (opcional, para ti como builder)

1. Abre [http://127.0.0.1:54323](http://127.0.0.1:54323).
2. Revisa tablas: `organizations`, `profiles`, `workflows`, etc.
3. Tras un signup verás tu org y tu profile creados.

---

## 3. Mapa de pantallas (web)

| URL | ¿Quién puede entrar? | Qué hace |
|-----|----------------------|----------|
| `/` | Todos | Landing + escena 3D hero |
| `/signup` | Público (si no hay sesión) | Crear cuenta + org |
| `/login` | Público (si no hay sesión) | Entrar |
| `/auth/callback` | Sistema (OAuth) | Intercambia código por sesión |
| `/auth/auth-code-error` | Público | Error de OAuth |
| `/dashboard` | Solo autenticados | Panel de la org (placeholder) |

La app móvil (`apps/mobile`) existe como esqueleto Expo, pero **aún no** tiene login ni bandeja de aprobaciones (eso es Fase 5).

---

## 4. Cómo está organizado el proyecto

```
ionexflow/
├── apps/
│   ├── web/       ← Command Center (Next.js) — lo que usas en el navegador
│   └── mobile/    ← Companion móvil (Expo) — futuro
├── packages/
│   ├── config/    ← TypeScript / ESLint compartidos
│   └── ui/        ← Componentes compartidos (vacío hasta Fase 3)
├── supabase/
│   ├── migrations/← Esquema SQL + RLS + trigger de signup
│   ├── config.toml
│   └── seed.sql
└── docs/          ← Specs y esta guía
```

| Pieza | Tecnología |
|-------|------------|
| Web | Next.js 14, React 18, Tailwind |
| Auth / DB | Supabase (Auth + PostgreSQL + RLS) |
| Monorepo | Turborepo + pnpm |
| 3D | Three.js + React Three Fiber |

---

## 5. Modelo de datos (qué guarda el sistema)

### Tablas principales

| Tabla | Para qué |
|-------|----------|
| **organizations** | La empresa/tenant. Aquí vivirá el estado de plan (`trial`, `active`, …) y luego IDs de Stripe. |
| **profiles** | Un perfil por usuario. Lo une a una org y define rol (`owner` / `member`). |
| **workflows** | Futuros grafos visuales (nodos/edges JSON). Fase 3. |
| **workflow_executions** | Cada corrida de un workflow. Fase 4. |
| **approvals** | Decisiones humanas (aprobar/rechazar un paso). Fase 5 + móvil. |

### Seguridad (RLS)

Cada consulta está limitada a **tu organización**. Un usuario de la org A no puede leer datos de la org B. Eso se hace con Row Level Security y helpers como `current_org_id()`.

---

## 6. Flujo completo de un usuario nuevo (diagrama mental)

```
Landing (/)
    │
    ▼
Signup (nombre, org, email, password)
    │
    ▼
Supabase Auth crea el usuario
    │
    ▼
Trigger SQL crea Organization (trial) + Profile (owner)
    │
    ▼
Sesión activa → Dashboard
    │
    ▼
Ves tu org y tu rol → Sign out cuando quieras
```

---

## 7. La UI 3D (qué es y para qué)

En **toda** la web hay un canvas Three.js de fondo:

- **Red neural** (nodos + conexiones + pulsos) → metáfora de agentes y flujos.
- **Núcleo orbital** (solo en la landing) → “corazón” del sistema; reacciona al mouse y al scroll.
- En **login/signup** y **dashboard** la red sigue, pero más calmada (no compite con formularios ni datos).

No es el producto de negocio en sí: es la **experiencia de marca** inmersiva. Los formularios y botones siguen siendo usables (el canvas no captura clics).

---

## 8. Qué NO puedes hacer todavía (roadmap)

| Fase | Qué llegará |
|------|-------------|
| **2** | Stripe: pagar, webhooks, paywall si el plan no es `trial`/`active` |
| **3** | Canvas visual (React Flow) para diseñar workflows + logs |
| **4** | Motor que ejecuta el grafo (agentes, pausas, errores) |
| **5** | App móvil: login + bandeja de aprobaciones en tiempo real |

Hasta entonces, tablas como `workflows` / `approvals` existen en la base, pero la UI aún no las usa.

---

## 9. Cómo arrancar el entorno (resumen)

```bash
# En la carpeta ionexflow/
pnpm install
npx supabase start          # o pnpm supabase:start si tienes la CLI en PATH
# Copia keys de `npx supabase status` a apps/web/.env.local
pnpm dev:web
```

URLs útiles:

| Servicio | URL |
|----------|-----|
| App web | http://localhost:3000 |
| Supabase Studio | http://127.0.0.1:54323 |
| API Supabase | http://127.0.0.1:54321 |

Variables web (`.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000`

---

## 10. En una frase

**IonexFlow** será la plataforma para diseñar, ejecutar y supervisar flujos de agentes de IA con aprobaciones humanas y cobro B2B; **hoy** ya puedes registrarte, pertenecer a una organización en trial, entrar al dashboard y vivir la experiencia visual del command center, mientras el resto del producto se construye encima de esta base.
