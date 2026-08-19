import type { PlanStatus } from "@/lib/database.types";

/** Soft monthly token budgets by plan. */
export function monthlyTokenBudget(plan: PlanStatus | null | undefined) {
  switch (plan) {
    case "active":
      return 500_000;
    case "trial":
      return 50_000;
    default:
      return 0;
  }
}

export function currentUsageMonthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function estimateTokensFromText(...parts: string[]) {
  const chars = parts.join("").length;
  return Math.max(1, Math.ceil(chars / 4));
}

export type QuotaSnapshot = {
  monthKey: string;
  used: number;
  budget: number;
  remaining: number;
  exceeded: boolean;
};

export function evaluateQuota(
  plan: PlanStatus | null | undefined,
  used: number,
  monthKeyStored: string | null | undefined
): QuotaSnapshot {
  const monthKey = currentUsageMonthKey();
  const effectiveUsed = monthKeyStored === monthKey ? used : 0;
  const budget = monthlyTokenBudget(plan);
  return {
    monthKey,
    used: effectiveUsed,
    budget,
    remaining: Math.max(0, budget - effectiveUsed),
    exceeded: budget > 0 && effectiveUsed >= budget,
  };
}
