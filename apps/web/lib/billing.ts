import type { PlanStatus } from "@/lib/database.types";

/** Trial and active can use the product. past_due / canceled hit the paywall. */
export function hasProductAccess(planStatus: PlanStatus | null | undefined) {
  return planStatus === "trial" || planStatus === "active";
}

export function isStripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_ID &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  );
}
