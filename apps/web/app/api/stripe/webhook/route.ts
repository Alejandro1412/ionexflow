import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { PlanStatus } from "@/lib/database.types";

export const runtime = "nodejs";

function planFromSubscription(sub: Stripe.Subscription): PlanStatus {
  switch (sub.status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    default:
      return "past_due";
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId =
          session.metadata?.org_id || session.client_reference_id || null;
        if (orgId && session.mode === "subscription") {
          await admin
            .from("organizations")
            .update({
              plan_status: "active",
              stripe_customer_id:
                typeof session.customer === "string" ? session.customer : null,
              stripe_subscription_id:
                typeof session.subscription === "string"
                  ? session.subscription
                  : null,
            })
            .eq("id", orgId);
        }
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : null;
        if (customerId) {
          await admin
            .from("organizations")
            .update({ plan_status: "active" })
            .eq("stripe_customer_id", customerId);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.org_id;
        const patch = {
          plan_status: planFromSubscription(sub),
          stripe_subscription_id: sub.id,
        };
        if (orgId) {
          await admin.from("organizations").update(patch).eq("id", orgId);
        } else if (typeof sub.customer === "string") {
          await admin
            .from("organizations")
            .update(patch)
            .eq("stripe_customer_id", sub.customer);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
