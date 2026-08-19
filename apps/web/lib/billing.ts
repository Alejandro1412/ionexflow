import type { PlanStatus } from "@/lib/database.types";

/** Trial and active can use the product. past_due / canceled hit the paywall. */
export function hasProductAccess(planStatus: PlanStatus | null | undefined) {
  return planStatus === "trial" || planStatus === "active";
}

export function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

export function isStripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_ID &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  );
}

export function isStripeWebhookConfigured() {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

/**
 * Activate Pro (dev) is NEVER available in production.
 * Locally it works when Stripe is missing, or when ALLOW_DEV_BILLING_BYPASS=true.
 */
export function isDevBillingBypassAllowed() {
  if (isProductionRuntime()) return false;
  if (!isStripeConfigured()) return true;
  return process.env.ALLOW_DEV_BILLING_BYPASS === "true";
}

export function stripeConfigIssues(): string[] {
  const issues: string[] = [];
  if (!process.env.STRIPE_SECRET_KEY) issues.push("STRIPE_SECRET_KEY");
  if (!process.env.STRIPE_PRICE_ID) issues.push("STRIPE_PRICE_ID");
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    issues.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  }
  if (isProductionRuntime() && !process.env.STRIPE_WEBHOOK_SECRET) {
    issues.push("STRIPE_WEBHOOK_SECRET");
  }
  return issues;
}
