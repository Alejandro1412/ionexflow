# IonexFlow — Guía completa del producto

Documento oficial: **para qué es**, **qué se puede hacer hoy**, **cómo lo usa una empresa**.

> **Matriz actualizada:** [ESTADO-FUNCIONAL.md](./ESTADO-FUNCIONAL.md)  
> **Manual paso a paso:** [MANUAL-COMPLETO.md](./MANUAL-COMPLETO.md)  
> **Deploy:** [DEPLOY.md](./DEPLOY.md) · Prod: https://ionexflow.vercel.app

---

## 1. ¿Para qué es?

**IonexFlow** es un *command center* B2B: diseñas procesos con IA, los conectas a **canales reales** (WhatsApp, correo, voz) y mantienes **aprobación humana** en lo delicado.

```
Canal (WhatsApp / email / voz / monitor / Run)
    → Knowledge de la empresa + historial del cliente
    → Agente(s) / Classifier / Condition
    → Approval humano (recomendado antes de responder al cliente)
    → Envío (WhatsApp / email / Slack / HTTP…)
    → Executions + Audit
```

### Para quién (LATAM)

| Perfil | Uso |
|--------|-----|
| Pymes de soporte / ventas | WhatsApp entrante → respuesta con políticas → approval → envío |
| Agencias | Research + copy + approval |
| Clínicas / inmobiliarias / legal / restaurantes | Plantillas verticales listas |
| Ops / founders | Monitors + Knowledge + “Descríbelo y te lo armo” |

### Qué NO es

- No es solo un chatbot genérico: el valor está en **Workflows + canales + Approvals + Knowledge**.
- No sustituye Meta Business Suite: **orquesta** con la Cloud API.
- Browser agent sin `BROWSER_WORKER_URL` simula; no es RPA cloud completo aún.

---

## 2. Mapa mental

```
Integrations (Email · WhatsApp · Voice)
        │
        ▼
Workflows  ←── Automations (plantillas + NL “Descríbelo…”)
   │                Knowledge (cerebro de la empresa)
   │                Monitors (proactivo)
   ▼
Executions · Approvals · Insights · Analytics · Audit
```

| Pieza | Pregunta |
|-------|----------|
| **Workflows** | ¿Cómo lo armo (IA o a mano) y lo corro? |
| **Integrations** | ¿De dónde entran y salen mensajes? |
| **Knowledge** | ¿Qué sabe la IA de *mi* negocio? |
| **Monitors** | ¿Qué vigilo sin esperar un mensaje? |
| **Insights** | ¿Qué aprendimos de rechazos? |
| **Approvals** | ¿Quién dice sí/no? |
| **Automations** | ¿Plantilla o describe en español? |

---

## 3. Qué puedes hacer hoy (resumen)

### Canales
- **WhatsApp Business (Meta Cloud API):** entrada (webhook) + salida (`whatsapp_send`). Plantilla *WhatsApp support* = Agent + Knowledge → Approval → Send.
- **Email IMAP/SMTP:** sync inbox, reply, forward.
- **Voice:** webhook con transcript → mismo motor.
- **Slack / HTTP / Webhook** nodos outbound.

### Inteligencia
- Agents con **Knowledge** (chunks rankeados + historial del cliente).
- Classifier, Condition, Document extract, Browser agent (simulate/worker).
- **Descríbelo y te lo armo** (español → grafo inactivo).
- AI Lab + Ionex Assistant.

### Control humano
- Approval con edición, SLA, botones Slack, app móvil Realtime.
- Test run / Safe mode; versiones de workflow.

### Operación
- Monitors → cron dispara workflow.
- Insights desde reject/edit.
- Analytics 30d, Audit log, Team invites, Stripe billing, cuotas AI.

### Verticales
Plantillas: inmobiliaria, legal, clínica, restaurante (+ marketing/soporte/ventas/ops).

---

## 4. Ruta feliz WhatsApp (LATAM)

1. Meta Developers → app + WhatsApp → Phone Number ID + token.
2. Ionex → **Integrations** → Connect WhatsApp + workflow por defecto.
3. Webhook Meta: `https://ionexflow.vercel.app/api/whatsapp/webhook` + verify token de la conexión.
4. Usa plantilla **WhatsApp support** (o NL: “cuando llegue WhatsApp…”).
5. Carga políticas en **Knowledge**.
6. Test run → Approve → Activate.
7. Mensaje real de prueba desde el móvil.

---

## 5. Ruta feliz correo enojado

1. Conecta mailbox en Integrations.
2. En Workflows: *“Cuando llegue un correo de un cliente enojado…”* → Armar con IA.
3. Revisa nodos email_send / forward al jefe + Approval.
4. Test run → Activa + Sync inbox.

---

## 6. Qué falta (honestidad)

- WhatsApp: sin media/HSM templates Meta aún (texto en ventana de 24h).
- Embeddings vectoriales full RAG (hoy ranking por tokens/chunks).
- Browser worker real hay que desplegarlo aparte.
- SSO / audit export enterprise.
- Push Expo nativo.

Detalle vivo: [ESTADO-FUNCIONAL.md](./ESTADO-FUNCIONAL.md).
