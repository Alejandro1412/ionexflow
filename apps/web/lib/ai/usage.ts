import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  currentUsageMonthKey,
  evaluateQuota,
  monthlyTokenBudget,
  type QuotaSnapshot,
} from "@/lib/ai/quotas";
import type { PlanStatus } from "@/lib/database.types";

export async function getOrgQuotaSnapshot(orgId: string): Promise<{
  plan: PlanStatus;
  quota: QuotaSnapshot;
  org: {
    allow_ai_overage?: boolean;
    ai_overage_tokens?: number;
  } | null;
}> {
  const admin = createServiceRoleClient();
  const { data: org } = await admin
    .from("organizations")
    .select(
      "plan_status, ai_tokens_used_month, ai_usage_month, allow_ai_overage, ai_overage_tokens"
    )
    .eq("id", orgId)
    .single();

  const plan = (org?.plan_status as PlanStatus) ?? "trial";
  const quota = evaluateQuota(
    plan,
    Number(org?.ai_tokens_used_month ?? 0),
    org?.ai_usage_month as string | null
  );
  return {
    plan,
    quota,
    org: org
      ? {
          allow_ai_overage: (org as { allow_ai_overage?: boolean })
            .allow_ai_overage,
          ai_overage_tokens: Number(
            (org as { ai_overage_tokens?: number }).ai_overage_tokens ?? 0
          ),
        }
      : null,
  };
}

export async function recordAiUsage(options: {
  orgId: string;
  source: string;
  provider: string;
  model?: string;
  promptTokens: number;
  completionTokens: number;
  meta?: Record<string, unknown>;
}) {
  const admin = createServiceRoleClient();
  const total = options.promptTokens + options.completionTokens;
  const monthKey = currentUsageMonthKey();

  const { data: org } = await admin
    .from("organizations")
    .select(
      "plan_status, ai_tokens_used_month, ai_usage_month, ai_overage_tokens"
    )
    .eq("id", options.orgId)
    .single();

  const prevMonth = org?.ai_usage_month as string | null;
  const prevUsed =
    prevMonth === monthKey ? Number(org?.ai_tokens_used_month ?? 0) : 0;
  const plan = (org?.plan_status as PlanStatus) ?? "trial";
  const budget = monthlyTokenBudget(plan);
  const nextUsed = prevUsed + total;
  const prevOverage =
    prevMonth === monthKey
      ? Number((org as { ai_overage_tokens?: number })?.ai_overage_tokens ?? 0)
      : 0;
  const overageDelta =
    budget > 0 && nextUsed > budget
      ? Math.min(total, nextUsed - budget)
      : 0;

  await admin
    .from("organizations")
    .update({
      ai_usage_month: monthKey,
      ai_tokens_used_month: nextUsed,
      ai_overage_tokens: prevOverage + overageDelta,
    })
    .eq("id", options.orgId);

  await admin.from("ai_usage_events").insert({
    org_id: options.orgId,
    source: options.source,
    provider: options.provider,
    model: options.model ?? null,
    prompt_tokens: options.promptTokens,
    completion_tokens: options.completionTokens,
    total_tokens: total,
    meta: {
      ...(options.meta ?? {}),
      ...(overageDelta > 0 ? { overageTokens: overageDelta } : {}),
    },
  });
}
