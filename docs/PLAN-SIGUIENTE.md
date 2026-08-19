# Plan de producto — qué falta y por qué

Objetivo: pasar de un **producto local demostrable** (ya con LLM, canvas, automations y assistant) a un **SaaS B2B pro** que empresas usen en producción.

Base actual: auth, workflows, agents LLM, classifiers, approvals web/móvil, AI Automations, Ionex Assistant, billing stub.  
Detalle de producto: [GUIA-DE-LA-APP.md](./GUIA-DE-LA-APP.md).

---

## Principio de orden (para “pro”)

1. **Deploy + Stripe** → clientes reales fuera de tu PC.  
2. **Equipo (invites + roles)** → copywriter ≠ director.  
3. **Notificaciones** → ✅ in-app + Resend; falta Expo push.  
4. **Integraciones HTTP** → ✅ nodos HTTP/Slack/Webhook; falta OAuth nativo.  
5. **Hardening** → cuotas, colas, compliance.

---

## Fase A — Agentes reales (LLM) ✅

### Estado
**Implementado.** Provider, runner async, playbooks, classifier, plantillas, AI Lab, UI de outputs, Assistant con fallback 429.

### Opcional restante en A
- Streaming en UI  
- Cuotas tokens por plan  
- Fallback 429 también en nodos Agent del engine (hoy el chat sí degrada)

---

## Fase B — Cobro real + deploy cloud ✅ (código + guía)

### Estado
**Listo en código y documentación.**  
- `docs/DEPLOY.md` — Vercel + Supabase Cloud + Stripe  
- `apps/web/vercel.json` — monorepo build  
- Activate Pro (dev) **bloqueado en production**  
- Checkout con `session_id` sync + Customer Portal  
- Webhook: checkout completed, subscription updated/deleted, invoice.paid  
- `scripts/check-prod-env.mjs`

### Qué te toca a ti (config)
1. Crear proyecto Supabase Cloud → `supabase db push`
2. Crear Price + webhook en Stripe
3. Importar repo en Vercel (Root Directory `apps/web`) + env vars
4. Probar signup → Checkout → `plan_status=active`

### Criterio de “listo” en tu cuenta
Signup → trial → Checkout → plan `active` en URL pública, sin botón Activate Pro.
---

## Fase C — Equipo (invitar miembros)

### Qué falta
DB tiene `owner` / `member`, pero no hay invitaciones, lista de usuarios ni permisos en UI.

### Para qué hacerlo
- B2B = **varios roles**: quien diseña el flujo ≠ quien aprueba.
- En el ejemplo de agencia, el copywriter corre el workflow y el **director** solo aprueba.
- Sin esto, IonexFlow es una herramienta personal, no de empresa.

### Qué implementar
1. Tabla o flujo `invites` (email, org, rol, token, expires).
2. UI en Settings / Team: invitar, listar, revocar.
3. Signup por invite (mismo org_id, rol `member`).
4. Permisos: solo `owner` edita billing; `member` puede ejecutar/aprobar según reglas.
5. Notificación email (opcional) al invitar.

### Criterio de “listo”
Owner invita a un email → ese usuario entra a la misma org y ve approvals/workflows.

### Esfuerzo estimado
M.

---

## Fase D — Grafos más inteligentes

### Qué falta
- Solo se sigue la **primera** arista.
- Solo 4 tipos de nodo.
- No hay condiciones ni paralelismo.

### Para qué hacerlo
- Procesos reales se **bifurcan**: “si el risk score > X → Approval legal; si no → End”.
- Sin ramas, muchos casos de negocio no caben en el canvas.
- Más nodos (HTTP, email, delay) convierten IonexFlow en orquestador, no solo “chat con pausa”.

### Qué implementar (en este orden interno)
1. ~~**Condition / branch**~~ → Classifier ya cubre ramas AI.
2. ~~Nodo **HTTP request**~~ → nodos `http` / `slack` / `webhook` implementados.
3. Nodo **Delay / Wait** (opcional).
4. (Más adelante) paralelo con join — más complejo; no es MVP.
5. OAuth nativo LinkedIn/Buffer (opcional; webhook cubre el 80%).

### Criterio de “listo”
Un grafo con Approval → Slack/Webhook publica al aprobar. ✅

### Esfuerzo estimado
L (diseño de datos + UI + runner) — **núcleo hecho**.

---

## Fase E — Móvil y UX de producto

### Qué falta
Móvil: solo login + inbox. No signup, no lista de ejecuciones, no push notifications.

### Para qué hacerlo
- Approvals en el móvil **ya son el diferenciador** human-in-the-loop.
- Push (“tienes 1 aprobación pendiente”) sube tasa de respuesta.
- Signup en móvil es nice-to-have; el editor visual puede quedarse en web.

### Qué implementar
1. Push (Expo Notifications) al crear `approvals` pending.
2. Detalle de approval con contexto (output del Agent anterior).
3. Lista simple de executions (solo lectura).
4. Deep link a approval concreto.

### Criterio de “listo”
Al pausar una ejecución, el móvil del aprobador recibe aviso y puede decidir sin abrir la web.

### Esfuerzo estimado
M.

---

## Fase F — Hardening (cuando ya hay usuarios)

### Qué falta / por qué
| Tema | Para qué |
|------|----------|
| Cuotas y rate limits LLM | Controlar coste; no quebrar con un loop |
| Retries / dead letter | Resiliencia en Agent/HTTP |
| Auditoría exportable | Compliance B2B |
| Tests E2E en CI | No romper el flujo feliz al iterar |
| `packages/ui` | Solo si mobile y web comparten muchos componentes |

No bloquea el primer cliente piloto; sí el crecimiento.

---

## Roadmap visual

```
Ahora (demo orquestada)
        │
        ▼
   [A] LLM en Agent     ←── prioridad #1 (valor de producto)
        │
        ▼
   [B] Stripe + Deploy  ←── prioridad #2 (dinero + demos reales)
        │
        ▼
   [C] Invitar equipo   ←── prioridad #3 (caso B2B real)
        │
        ▼
   [D] Ramas + HTTP     ←── prioridad #4 (casos de negocio ricos)
        │
        ▼
   [E] Push móvil       ←── prioridad #5 (cierra el loop humano)
        │
        ▼
   [F] Hardening        ←── continuo
```

---

## Qué NO priorizar todavía

| Idea | Por qué esperar |
|------|-----------------|
| Editor de workflows en móvil | Pantalla pequeña; el valor móvil es **aprobar**, no diseñar |
| Multi-LLM marketplace | Un proveedor bien hecho > cinco a medias |
| Paralelismo complejo | Ramas simples cubren el 80% |
| Reescribir `packages/ui` | Costo de abstracción sin beneficio claro aún |

---

## Primer sprint recomendado (concreto)

**Meta:** “El Agent escribe de verdad y un humano aprueba el texto.”

1. Integrar OpenAI (o Anthropic) en el runner del nodo Agent.
2. Persistir `output` en logs + payload del approval.
3. Mostrar ese texto en `/dashboard/approvals` y en el móvil.
4. Probar el flujo de la guía: Brief → Draft → Approval director → End.
5. (Opcional mismo sprint) Doc mínima de env vars AI.

Con eso el ejemplo de agencia de marketing **deja de ser hipotético**.

---

## Relación con lo ya construido

| Ya tienes | Sirve para |
|-----------|------------|
| Canvas + 4 nodos | Diseñar el proceso |
| Motor + pause/resume | Orquestar sin reinventar |
| Approvals web/móvil | Human-in-the-loop |
| Billing stub + paywall | Meter Stripe sin rehacer UI |
| Org + RLS | Multi-tenant listo para invites |

No tires el motor: **extiéndelo**. El plan no es “hacer otra app”; es enchufar inteligencia, dinero, equipo y ramas encima de lo que ya corre.
