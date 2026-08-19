"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { getStripe } from "@/lib/stripe";
import {
  isDevBillingBypassAllowed,
  isStripeConfigured,
} from "@/lib/billing";

function siteOrigin(headerOrigin: string | null) {
  return (
    headerOrigin ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export async function createCheckoutSession() {
  const session = await getSessionProfile();
  if (!session?.org) throw new Error("Not authenticated");
  if (session.profile.role !== "owner") {
    throw new Error("Only owners can manage billing");
  }
  if (!isStripeConfigured()) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY, STRIPE_PRICE_ID, and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY."
    );
  }

  const stripe = getStripe();
  const origin = siteOrigin((await headers()).get("origin"));
  const supabase = await createClient();

  let customerId = session.org.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: session.org.name,
      metadata: { org_id: session.org.id },
    });
    customerId = customer.id;
    await supabase
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", session.org.id);
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: session.org.id,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${origin}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/billing?checkout=cancel`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    metadata: { org_id: session.org.id },
    subscription_data: {
      metadata: { org_id: session.org.id },
    },
  });

  if (!checkout.url) throw new Error("Could not create Checkout session");
  const { writeAuditEvent } = await import("@/lib/audit");
  await writeAuditEvent({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "billing.checkout",
    targetType: "organization",
    targetId: session.org.id,
  });
  redirect(checkout.url);
}

export async function createBillingPortalSession() {
  const session = await getSessionProfile();
  if (!session?.org?.stripe_customer_id) {
    throw new Error("No Stripe customer on this organization yet");
  }
  if (session.profile.role !== "owner") {
    throw new Error("Only owners can manage billing");
  }
  if (!isStripeConfigured()) throw new Error("Stripe is not configured");

  const stripe = getStripe();
  const origin = siteOrigin((await headers()).get("origin"));
  const portal = await stripe.billingPortal.sessions.create({
    customer: session.org.stripe_customer_id,
    return_url: `${origin}/dashboard/billing`,
  });
  redirect(portal.url);
}

/**
 * After Checkout success, sync plan from Stripe session even if webhook is delayed.
 */
export async function syncCheckoutSession(checkoutSessionId: string) {
  const session = await getSessionProfile();
  if (!session?.org) throw new Error("Not authenticated");
  if (!isStripeConfigured()) throw new Error("Stripe is not configured");
  if (!checkoutSessionId.startsWith("cs_")) {
    throw new Error("Invalid checkout session id");
  }

  const stripe = getStripe();
  const checkout = await stripe.checkout.sessions.retrieve(checkoutSessionId);

  const orgId = checkout.metadata?.org_id || checkout.client_reference_id;
  if (!orgId || orgId !== session.org.id) {
    throw new Error("Checkout session does not belong to this organization");
  }

  if (checkout.status !== "complete") {
    return { synced: false as const, reason: "not_complete" };
  }

  const admin = createServiceRoleClient();
  const subscriptionId =
    typeof checkout.subscription === "string"
      ? checkout.subscription
      : checkout.subscription?.id ?? null;
  const customerId =
    typeof checkout.customer === "string"
      ? checkout.customer
      : checkout.customer?.id ?? null;

  await admin
    .from("organizations")
    .update({
      plan_status: "active",
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
    })
    .eq("id", session.org.id);

  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  return { synced: true as const };
}

/** Local-only path when Stripe keys are missing — blocked in production. */
export async function activateProDev() {
  if (!isDevBillingBypassAllowed()) {
    throw new Error(
      "Activate Pro (dev) is disabled in production and when Stripe is configured without ALLOW_DEV_BILLING_BYPASS."
    );
  }

  const session = await getSessionProfile();
  if (!session?.org) throw new Error("Not authenticated");
  if (session.profile.role !== "owner") throw new Error("Only owners can change billing");

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("organizations")
    .update({ plan_status: "active" })
    .eq("id", session.org.id);

  if (error) throw new Error(error.message);
  redirect("/dashboard/billing?activated=1");
}
