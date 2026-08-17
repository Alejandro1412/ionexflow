import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/org";
import { isStripeConfigured } from "@/lib/billing";
import {
  activateProDev,
  createBillingPortalSession,
  createCheckoutSession,
} from "@/actions/billing";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { paywall?: string; checkout?: string; activated?: string };
}) {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");

  const stripeReady = isStripeConfigured();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold glow-text">Billing</h1>
        <p className="text-muted-foreground">
          Manage your organization plan. Trial and Active unlock product features.
        </p>
      </div>

      {searchParams.paywall ? (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm">
          Your current plan blocks workflows. Upgrade or reactivate below.
        </div>
      ) : null}
      {searchParams.checkout === "success" ? (
        <div className="rounded-lg border border-signal/40 bg-signal/10 px-4 py-3 text-sm">
          Checkout completed. Plan status updates via Stripe webhook.
        </div>
      ) : null}
      {searchParams.activated ? (
        <div className="rounded-lg border border-signal/40 bg-signal/10 px-4 py-3 text-sm">
          Dev activation applied — plan set to active.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{session.org.name}</CardTitle>
          <CardDescription>
            Status: <strong className="capitalize text-foreground">{session.org.plan_status}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {stripeReady ? (
            <>
              <form action={createCheckoutSession}>
                <Button type="submit" className="w-full sm:w-auto">
                  Upgrade with Stripe Checkout
                </Button>
              </form>
              {session.org.stripe_customer_id ? (
                <form action={createBillingPortalSession}>
                  <Button type="submit" variant="outline" className="w-full sm:w-auto">
                    Open customer portal
                  </Button>
                </form>
              ) : null}
            </>
          ) : (
            <form action={activateProDev}>
              <Button type="submit" className="w-full sm:w-auto">
                Activate Pro (dev)
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Stripe keys are not set. This local bypass marks the org as{" "}
                <code>active</code>. Add <code>STRIPE_SECRET_KEY</code>,{" "}
                <code>STRIPE_PRICE_ID</code>, and{" "}
                <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> for real Checkout.
              </p>
            </form>
          )}
          <Button asChild variant="ghost">
            <Link href="/pricing">View pricing</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
