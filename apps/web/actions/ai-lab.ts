"use server";

import { generateWithMode } from "@/lib/ai/provider";
import type { AgentMode } from "@/lib/ai/modes";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";

export type AiLabState = {
  error?: string;
  output?: string;
  model?: string;
  provider?: string;
  latencyMs?: number;
  demo?: boolean;
} | null;

export async function runAiLab(
  _prev: AiLabState,
  formData: FormData
): Promise<AiLabState> {
  const session = await getSessionProfile();
  if (!session?.org) return { error: "Not authenticated" };
  if (!hasProductAccess(session.org.plan_status)) {
    return { error: "Upgrade required" };
  }

  const prompt = String(formData.get("prompt") ?? "").trim();
  const mode = (String(formData.get("mode") ?? "general") || "general") as AgentMode;
  if (!prompt) return { error: "Write a task for the lab agent." };

  try {
    const result = await generateWithMode({
      agentLabel: `Lab · ${mode}`,
      prompt,
      mode,
      triggerPayload: {
        input: prompt,
        startedBy: session.profile.full_name ?? session.user.email,
        source: "ai-lab",
      },
      context: {},
      orgId: session.org.id,
      source: "ai-lab",
    });
    return {
      output: result.notice
        ? `${result.text}\n\n---\n_${result.notice}_`
        : result.text,
      model: result.model,
      provider: result.provider,
      latencyMs: result.latencyMs,
      demo: result.demo,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "AI lab failed",
    };
  }
}
