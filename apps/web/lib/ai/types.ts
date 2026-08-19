export type AiProviderId = "openai" | "anthropic" | "demo";

export type AiGenerateInput = {
  agentLabel: string;
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  triggerPayload: Record<string, unknown>;
  context: Record<string, string>;
  /** Optional instruction for classifiers: return only a route key */
  classifyRoutes?: string[];
  /** When set, enforces org quota and records usage */
  orgId?: string;
  source?: string;
};

export type AiGenerateResult = {
  text: string;
  provider: AiProviderId;
  model: string;
  latencyMs: number;
  demo: boolean;
  /** When classifyRoutes was set */
  route?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** Soft-degrade notice (quota / 429) */
  notice?: string;
};

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-haiku-latest";

export const DEFAULT_AGENT_SYSTEM = `You are an elite IonexFlow autonomous agent inside a B2B workflow command center.
Write crisp, executive-ready output in Markdown.
Use short sections with ## headings, bullets where useful, and a clear recommendation.
Never invent confidential company secrets; if data is missing, state assumptions explicitly.
Match the language of the user task (Spanish if the task is in Spanish, English otherwise).`;
