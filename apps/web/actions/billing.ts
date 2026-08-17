"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { getStripe } from "@/lib/stripe";
import { isStripeConfigured } from "@/lib/billing";

export async function createCheckoutSession() {
  const session = await getSessionProfile();
  if (!session?.org) throw new Error("Not authenticated");
  if (!isStripeConfigured()) {
    throw new Error(
      "Stripe is not configured. Use Activate Pro (dev) on the billing page, or set STRIPE_* env vars."
    );
  }

  const stripe = getStripe();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL!;
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
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${origin}/dashboard/billing?checkout=success`,
    cancel_url: `${origin}/dashboard/billing?checkout=cancel`,
    metadata: { org_id: session.org.id },
    subscription_data: { metadata: { org_id: session.org.id } },
  });

  if (!checkout.url) throw new Error("Could not create Checkout session");
  redirect(checkout.url);
}

export async function createBillingPortalSession() {
  const session = await getSessionProfile();
  if (!session?.org?.stripe_customer_id) {
    throw new Error("No Stripe customer on this organization yet");
  }
  if (!isStripeConfigured()) throw new Error("Stripe is not configured");

  const stripe = getStripe();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL!;
  const portal = await stripe.billingPortal.sessions.create({
    customer: session.org.stripe_customer_id,
    return_url: `${origin}/dashboard/billing`,
  });
  redirect(portal.url);
}

/** Local/dev path when Stripe keys are missing — marks org as active. */
export async function activateProDev() {
  if (isStripeConfigured() && process.env.ALLOW_DEV_BILLING_BYPASS !== "true") {
    throw new Error("Dev bypass disabled while Stripe is configured");
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
