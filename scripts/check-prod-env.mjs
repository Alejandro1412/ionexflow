#!/usr/bin/env node
/**
 * Quick check that production-critical env vars look present.
 * Usage (from apps/web or repo root with env loaded):
 *   node scripts/check-prod-env.mjs
 */

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
];

const recommended = ["OPENAI_API_KEY", "RESEND_API_KEY"];

const missing = required.filter((k) => !process.env[k]?.trim());
const missingRec = recommended.filter((k) => !process.env[k]?.trim());

const isProd =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";

console.log("IonexFlow production env check");
console.log("------------------------------");
console.log(`Runtime prod-like: ${isProd}`);

if (missing.length) {
  console.error("MISSING required:", missing.join(", "));
  process.exitCode = 1;
} else {
  console.log("Required vars: OK");
}

if (missingRec.length) {
  console.warn("Recommended missing:", missingRec.join(", "));
}

if (isProd && process.env.ALLOW_DEV_BILLING_BYPASS === "true") {
  console.error(
    "FAIL: ALLOW_DEV_BILLING_BYPASS must not be true in production"
  );
  process.exitCode = 1;
} else {
  console.log("Dev billing bypass: OK (disabled or non-prod)");
}

if (process.env.NEXT_PUBLIC_SITE_URL?.includes("localhost") && isProd) {
  console.warn(
    "WARN: NEXT_PUBLIC_SITE_URL points to localhost in a prod-like runtime"
  );
}
