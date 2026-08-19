import {
  buildAssistantSystemPrompt,
  type AssistantUserContext,
} from "@/lib/ai/assistant-knowledge";
import { DEFAULT_ANTHROPIC_MODEL, DEFAULT_OPENAI_MODEL } from "@/lib/ai/types";
import { resolveAiProvider } from "@/lib/ai/provider";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AssistantReply = {
  content: string;
  provider: string;
  model: string;
  demo: boolean;
  notice?: string;
};

function firstNameOf(user: AssistantUserContext) {
  return user.firstName || "amigo";
}

function conversationalDemo(
  history: ChatMessage[],
  user: AssistantUserContext
): string {
  const name = firstNameOf(user);
  const users = history.filter((m) => m.role === "user").map((m) => m.content);
  const last = (users[users.length - 1] ?? "").trim();
  const q = last.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const turn = users.length;

  const isGreeting =
    /^(hola|hi|hello|hey|buenas|buenos dias|buenas tardes|buenas noches|saludos|que tal|qué tal)\b/.test(
      q
    ) || /^(hola|hey|hi)[\s!.,]*$/.test(q);

  const isHowAreYou =
    /como estas|cómo estás|como te va|qué tal estás|que tal estas|how are you|how's it going/.test(
      q
    );

  if (isGreeting && isHowAreYou) {
    return [
      `¡Hola, **${name}**! Qué gusto verte por aquí.`,
      ``,
      `Yo muy bien, gracias por preguntar — listo para echarte una mano con IonexFlow.`,
      `¿Tú cómo estás hoy? ¿Más de explorar la app o ya quieres automatizar algo concreto?`,
    ].join("\n");
  }

  if (isHowAreYou) {
    return [
      `¡Bien, ${name}, gracias! Por aquí con energía para ayudarte.`,
      ``,
      `¿Y tú qué tal? Si quieres, después me cuentas qué estás intentando hacer en el dashboard y lo vemos juntos.`,
    ].join("\n");
  }

  if (isGreeting) {
    const hourHint = ""; // keep simple
    return [
      `¡Hola, **${name}**!${hourHint} Me alegra que escribas.`,
      ``,
      `Soy Ionex, tu copiloto en **${user.orgName || "tu organización"}**.`,
      `Puedo explicarte la plataforma, guiarte paso a paso o simplemente charlar un momento.`,
      ``,
      `¿Cómo estás hoy? ¿En qué te puedo acompañar?`,
    ].join("\n");
  }

  if (
    /bien|muy bien|todo bien|genial|excelente|de lujo|super|súper|cansado|cansada|estresado|estresada|regular|mas o menos|más o menos/.test(
      q
    ) &&
    turn <= 3
  ) {
    if (/cansado|cansada|estresado|estresada|regular|mas o menos|más o menos/.test(q)) {
      return [
        `Te escucho, ${name}. Si vienes con la cabeza llena, vamos despacio.`,
        ``,
        `Cuando quieras podemos hacer algo corto y útil: por ejemplo lanzar una plantilla en **AI Automations** o que te explique Approvals en 1 minuto.`,
        ``,
        `¿Prefieres algo rapidito o prefieres que te cuente el panorama completo?`,
      ].join("\n");
    }
    return [
      `¡Qué bueno, ${name}! Me alegra.`,
      ``,
      `Cuando quieras entramos en materia. En IonexFlow puedes diseñar flujos con IA, pausarlos para aprobación humana y ver todo el historial.`,
      ``,
      `¿Hoy te apetece **crear un workflow**, mirar **plantillas**, o que te haga un **tour guiado**?`,
    ].join("\n");
  }

  if (/^(gracias|ok|vale|perfecto|genial|listo|de acuerdo)\b/.test(q)) {
    return [
      `Con gusto, ${name}.`,
      ``,
      `Cuando quieras seguimos: dime “plantillas”, “workflow” o cuéntame tu caso de negocio en una frase.`,
      `¿Seguimos ahora o lo dejamos aquí un momento?`,
    ].join("\n");
  }

  if (/quien eres|quién eres|que eres|qué eres|tu nombre/.test(q)) {
    return [
      `Soy **Ionex**, ${name}: el asistente de IonexFlow.`,
      `Estoy aquí para conocerte un poco, explicarte la app y ayudarte a automatizar procesos con agentes + approvals.`,
      ``,
      `Trabajas en **${user.orgName || "tu org"}** como **${user.role}** (plan **${user.planStatus}**), así que puedo aterrizar las ideas a tu contexto.`,
      ``,
      `¿Qué te gustaría que hagamos primero juntos?`,
    ].join("\n");
  }

  if (/^[1-5]$/.test(q.trim()) || /opcion\s*[1-5]|opción\s*[1-5]/.test(q)) {
    const n = q.match(/[1-5]/)?.[0] ?? q.trim();
    if (n === "1") {
      return [
        `${name}, te resumo el mapa sin rodeos:`,
        `- **Overview** — el pulso de tu org`,
        `- **AI Automations** — plantillas y el lab`,
        `- **Workflows** — el canvas`,
        `- **Executions / Approvals** — corridas y decisiones humanas`,
        `- **Billing** — tu plan`,
        ``,
        `¿Quieres que profundicemos en una pantalla o vamos directo a crear algo?`,
      ].join("\n");
    }
    if (n === "2") {
      return [
        `Perfecto, ${name}. Para tu primer workflow:`,
        `1. Entra a **Workflows** o usa una plantilla en **AI Automations**`,
        `2. Revisa Start → Agent → Approval → End`,
        `3. Ajusta el playbook del Agent`,
        `4. Pega un brief real y dale **Run**`,
        `5. Mira **Approvals**`,
        ``,
        `¿Te preparo un brief de ejemplo según tu caso (marketing, soporte, ventas u ops)?`,
      ].join("\n");
    }
    if (n === "3") {
      return [
        `${name}, en **AI Automations** tienes: Content, Rewrite, Support triage, Sales qualify y Ops playbook.`,
        ``,
        `Un clic crea el grafo. ¿Cuál suena más a lo que necesitas hoy?`,
      ].join("\n");
    }
    if (n === "4") {
      return [
        `Approvals es tu freno humano, ${name}: el flujo pausa, ves el output del agente y decides Approve/Reject (también en el móvil).`,
        ``,
        `¿Quieres que te guíe a probarlo con la plantilla de marketing?`,
      ].join("\n");
    }
    return [
      `Casos reales, ${name}: marketing (copy + director), soporte (triage), ventas (lead hot/warm), ops (playbook).`,
      ``,
      `¿Cuál se parece más a tu día a día?`,
    ].join("\n");
  }

  if (q.includes("plantilla") || q.includes("automat") || q.includes("automations")) {
    return [
      `Claro, ${name}. En \`/dashboard/automations\` están las plantillas y el AI Lab.`,
      `Content, Rewrite, Support triage, Sales qualify, Ops playbook — listas para Run.`,
      ``,
      `¿Cuál te late más para ${user.orgName || "tu equipo"}?`,
    ].join("\n");
  }

  if (q.includes("approval") || q.includes("aprob") || q.includes("movil") || q.includes("mobile")) {
    return [
      `${name}, Approvals es el corazón human-in-the-loop: el Agent trabaja, tú (o un director) decides.`,
      `Web en **Approvals**, móvil con Realtime.`,
      ``,
      `¿Lo vemos con un ejemplo de copy o de ticket de soporte?`,
    ].join("\n");
  }

  if (q.includes("workflow") || q.includes("canvas") || q.includes("classifier") || q.includes("nodo")) {
    return [
      `En el canvas combinas **Agent** (IA), **Classifier** (ramas) y **Approval** (humano), ${name}.`,
      ``,
      `¿Montamos uno lineal y simple, o uno con Classifier tipo soporte/ventas?`,
    ].join("\n");
  }

  if (q.includes("billing") || q.includes("stripe") || q.includes("plan") || q.includes("cobr")) {
    return [
      `Tu plan actual es **${user.planStatus}**, ${name}.`,
      `Con trial/active usas el producto; en local puedes usar Activate Pro (dev) si no hay Stripe.`,
      ``,
      `¿Quieres que te explique el paywall o volvemos a automatizar procesos?`,
    ].join("\n");
  }

  return [
    `Te leo, ${name}: “${last.slice(0, 160)}${last.length > 160 ? "…" : ""}”.`,
    ``,
    `Tiene sentido abordarlo en IonexFlow con un workflow (Agent + Approval) o una plantilla de AI Automations.`,
    ``,
    `Para afinar: ¿esto es más **marketing**, **soporte**, **ventas** u **ops** en ${user.orgName || "tu org"}?`,
  ].join("\n");
}

async function callOpenAI(
  history: ChatMessage[],
  apiKey: string,
  user: AssistantUserContext
): Promise<AssistantReply> {
  const model = process.env.IONEX_ASSISTANT_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: buildAssistantSystemPrompt(user) },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    const error = new Error(`openai:${res.status}:${err.slice(0, 200)}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("openai:empty");
  return { content, provider: "openai", model, demo: false };
}

async function callAnthropic(
  history: ChatMessage[],
  apiKey: string,
  user: AssistantUserContext
): Promise<AssistantReply> {
  const model = process.env.IONEX_ASSISTANT_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1600,
      temperature: 0.7,
      system: buildAssistantSystemPrompt(user),
      messages: history.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    const error = new Error(`anthropic:${res.status}:${err.slice(0, 200)}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }

  const json = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const content = json.content?.find((c) => c.type === "text")?.text?.trim();
  if (!content) throw new Error("anthropic:empty");
  return { content, provider: "anthropic", model, demo: false };
}

function demoReply(
  history: ChatMessage[],
  user: AssistantUserContext,
  notice?: string
): AssistantReply {
  return {
    content: conversationalDemo(history, user),
    provider: "demo",
    model: "ionex-assistant-demo",
    demo: true,
    notice,
  };
}

export async function generateAssistantReply(
  messages: ChatMessage[],
  user: AssistantUserContext
): Promise<AssistantReply> {
  const provider = resolveAiProvider();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();

  const history = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-16);

  if (provider === "demo" || (!openaiKey && !anthropicKey)) {
    return demoReply(history, user);
  }

  const preferAnthropic = provider === "anthropic" && !!anthropicKey;
  const order: Array<"openai" | "anthropic"> = preferAnthropic
    ? anthropicKey && openaiKey
      ? ["anthropic", "openai"]
      : ["anthropic"]
    : openaiKey && anthropicKey
      ? ["openai", "anthropic"]
      : openaiKey
        ? ["openai"]
        : ["anthropic"];

  let lastErr: unknown;
  for (const which of order) {
    try {
      if (which === "openai" && openaiKey) {
        return await callOpenAI(history, openaiKey, user);
      }
      if (which === "anthropic" && anthropicKey) {
        return await callAnthropic(history, anthropicKey, user);
      }
    } catch (error) {
      lastErr = error;
      continue;
    }
  }

  const quota =
    lastErr instanceof Error && /429|quota|billing/i.test(lastErr.message);
  return demoReply(
    history,
    user,
    quota
      ? "Sin cuota LLM live por ahora — sigo conversando contigo en modo guía personalizada."
      : "El modelo live no respondió — sigo aquí contigo en modo guía."
  );
}
