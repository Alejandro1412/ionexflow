import { resolveAiProvider } from "@/lib/ai/provider";

/** Server-only helper for UI banners. */
export function getAiRuntimeStatus() {
  const provider = resolveAiProvider();
  if (provider === "demo") {
    return {
      provider,
      live: false,
      label: "Demo intelligence",
      hint: "Add OPENAI_API_KEY or ANTHROPIC_API_KEY to apps/web/.env.local for live LLM agents.",
    } as const;
  }
  return {
    provider,
    live: true,
    label: provider === "openai" ? "OpenAI live" : "Anthropic live",
    hint: "Agent nodes call a real model on every Run.",
  } as const;
}
