import { systemForMode, type AgentMode } from "@/lib/ai/modes";
import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OPENAI_MODEL,
  type AiGenerateInput,
  type AiGenerateResult,
  type AiProviderId,
} from "@/lib/ai/types";

function buildUserMessage(input: AiGenerateInput) {
  const contextBlock =
    Object.keys(input.context).length === 0
      ? "(none yet)"
      : Object.entries(input.context)
          .map(([key, value]) => `### ${key}\n${value}`)
          .join("\n\n");

  if (input.classifyRoutes?.length) {
    return [
      `Classify the following into EXACTLY one of these route keys:`,
      input.classifyRoutes.map((r) => `- ${r}`).join("\n"),
      ``,
      `Reply with ONLY the route key (no quotes, no markdown, no explanation).`,
      ``,
      `## Classifier task`,
      input.prompt,
      ``,
      `## Trigger`,
      JSON.stringify(input.triggerPayload, null, 2),
      ``,
      `## Context`,
      contextBlock,
    ].join("\n");
  }

  return [
    `## Agent role`,
    input.agentLabel,
    ``,
    `## Task`,
    input.prompt,
    ``,
    `## Trigger payload`,
    "```json",
    JSON.stringify(input.triggerPayload, null, 2),
    "```",
    ``,
    `## Upstream agent context`,
    contextBlock,
  ].join("\n");
}

function normalizeRoute(raw: string, routes: string[]) {
  const cleaned = raw.trim().toLowerCase().replace(/[`"'.,]/g, "").split(/\s+/)[0] ?? "";
  const exact = routes.find((r) => r.toLowerCase() === cleaned);
  if (exact) return exact;
  const partial = routes.find(
    (r) => cleaned.includes(r.toLowerCase()) || r.toLowerCase().includes(cleaned)
  );
  return partial ?? routes[0]!;
}

function spectacularDemo(input: AiGenerateInput): AiGenerateResult {
  const started = Date.now();
  const brief =
    typeof input.triggerPayload.input === "string"
      ? input.triggerPayload.input
      : JSON.stringify(input.triggerPayload);

  if (input.classifyRoutes?.length) {
    const lower = `${brief} ${input.prompt} ${Object.values(input.context).join(" ")}`.toLowerCase();
    let route = input.classifyRoutes[0]!;
    if (lower.match(/urgent|legal|riesgo|risk|hate|refund|enterprise|hot/)) {
      route =
        input.classifyRoutes.find((r) =>
          /human|risk|hot|legal|escalat|high/i.test(r)
        ) ?? route;
    } else if (lower.match(/simple|faq|cold|low|ok|auto/)) {
      route =
        input.classifyRoutes.find((r) => /auto|low|cold|ok|simple/i.test(r)) ??
        input.classifyRoutes[input.classifyRoutes.length - 1]!;
    }
    return {
      text: route,
      route,
      provider: "demo",
      model: "ionex-demo-classifier",
      latencyMs: Math.max(30, Date.now() - started),
      demo: true,
    };
  }

  const prior = Object.values(input.context).at(-1);
  const label = input.agentLabel.toLowerCase();
  const text = [
    `## ${input.agentLabel}`,
    ``,
    `> Demo intelligence — add OPENAI_API_KEY for live models.`,
    ``,
    `### Deliverable`,
    input.prompt,
    ``,
    `### Trigger signal`,
    brief.slice(0, 400),
    ``,
    prior ? `### Built on upstream\n${prior.slice(0, 500)}` : `### Upstream\n(none)`,
    ``,
    `### Recommendation`,
    label.includes("sales")
      ? "Prioritize a human follow-up if score is Hot; otherwise nurture."
      : "Send to the next human gate if claims or customer impact are non-trivial.",
  ].join("\n");

  return {
    text,
    provider: "demo",
    model: "ionex-demo-intelligence",
    latencyMs: Math.max(40, Date.now() - started),
    demo: true,
  };
}

async function generateOpenAI(input: AiGenerateInput, apiKey: string): Promise<AiGenerateResult> {
  const started = Date.now();
  const model = input.model?.trim() || DEFAULT_OPENAI_MODEL;
  const temperature = input.classifyRoutes?.length ? 0 : (input.temperature ?? 0.7);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        {
          role: "system",
          content: input.systemPrompt?.trim() || "You are a precise IonexFlow agent.",
        },
        { role: "user", content: buildUserMessage(input) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 280)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned an empty response");

  const route = input.classifyRoutes?.length
    ? normalizeRoute(text, input.classifyRoutes)
    : undefined;

  return {
    text: route ?? text,
    route,
    provider: "openai",
    model,
    latencyMs: Date.now() - started,
    demo: false,
  };
}

async function generateAnthropic(input: AiGenerateInput, apiKey: string): Promise<AiGenerateResult> {
  const started = Date.now();
  const model = input.model?.trim() || DEFAULT_ANTHROPIC_MODEL;
  const temperature = input.classifyRoutes?.length ? 0 : (input.temperature ?? 0.7);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: input.classifyRoutes?.length ? 64 : 2048,
      temperature,
      system: input.systemPrompt?.trim() || "You are a precise IonexFlow agent.",
      messages: [{ role: "user", content: buildUserMessage(input) }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${errText.slice(0, 280)}`);
  }

  const json = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = json.content?.find((c) => c.type === "text")?.text?.trim();
  if (!text) throw new Error("Anthropic returned an empty response");

  const route = input.classifyRoutes?.length
    ? normalizeRoute(text, input.classifyRoutes)
    : undefined;

  return {
    text: route ?? text,
    route,
    provider: "anthropic",
    model,
    latencyMs: Date.now() - started,
    demo: false,
  };
}

export function resolveAiProvider(): AiProviderId {
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  return "demo";
}

export async function generateAgentOutput(input: AiGenerateInput): Promise<AiGenerateResult> {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const preferred = process.env.IONEX_AI_PROVIDER?.trim().toLowerCase();

  if (preferred === "demo") return spectacularDemo(input);
  if (preferred === "anthropic" && anthropicKey) return generateAnthropic(input, anthropicKey);
  if (preferred === "openai" && openaiKey) return generateOpenAI(input, openaiKey);
  if (openaiKey) return generateOpenAI(input, openaiKey);
  if (anthropicKey) return generateAnthropic(input, anthropicKey);
  return spectacularDemo(input);
}

export async function generateWithMode(
  input: Omit<AiGenerateInput, "systemPrompt"> & {
    mode?: AgentMode;
    systemPrompt?: string;
  }
) {
  return generateAgentOutput({
    ...input,
    systemPrompt: systemForMode(input.mode, input.systemPrompt),
  });
}
