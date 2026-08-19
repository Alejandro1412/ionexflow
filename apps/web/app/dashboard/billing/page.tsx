import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/org";
import {
  isDevBillingBypassAllowed,
  isStripeConfigured,
  isStripeWebhookConfigured,
  stripeConfigIssues,
} from "@/lib/billing";
import { getOrgQuotaSnapshot } from "@/lib/ai/usage";
import { getAiRuntimeStatus } from "@/lib/ai/status";
import {
  activateProDev,
  createBillingPortalSession,
  createCheckoutSession,
  syncCheckoutSession,
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
  searchParams: {
    paywall?: string;
    checkout?: string;
    activated?: string;
    session_id?: string;
  };
}) {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");

  const stripeReady = isStripeConfigured();
  const bypassAllowed = isDevBillingBypassAllowed();
  const webhookReady = isStripeWebhookConfigured();
  const missing = stripeConfigIssues();
  const ai = getAiRuntimeStatus();
  let quotaLabel = "—";
  try {
    const { quota } = await getOrgQuotaSnapshot(session.org.id);
    quotaLabel = `${quota.used.toLocaleString()} / ${quota.budget.toLocaleString()} tokens (${quota.monthKey})`;
  } catch {
    quotaLabel = "Usage tracking pending migration";
  }

  let syncNote: string | null = null;
  if (searchParams.checkout === "success" && searchParams.session_id) {
    try {
      const result = await syncCheckoutSession(searchParams.session_id);
      syncNote = result.synced
        ? "Checkout synced — your plan is now active."
        : "Checkout finished. Waiting for Stripe confirmation…";
    } catch {
      syncNote =
        "Checkout finished. If status stays on trial, wait for the webhook or refresh in a minute.";
    }
  }

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
          {syncNote ??
            "Checkout completed. Plan status updates via Stripe webhook."}
        </div>
      ) : null}
      {searchParams.checkout === "cancel" ? (
        <div className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-muted-foreground">
          Checkout canceled — no charge was made.
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
            Status:{" "}
            <strong className="capitalize text-foreground">
              {session.org.plan_status}
            </strong>
            {session.profile.role !== "owner" ? (
              <span className="ml-2 text-xs">(only owners can change billing)</span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm">
            <p>
              <span className="text-muted-foreground">AI runtime:</span>{" "}
              <strong>{ai.label}</strong>
            </p>
            <p className="mt-1 text-muted-foreground">{ai.hint}</p>
            <p className="mt-2">
              <span className="text-muted-foreground">Monthly tokens:</span>{" "}
              <strong>{quotaLabel}</strong>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Trial ≈ 50k tokens/month · Active ≈ 500k. Over quota soft-falls back to
              demo intelligence.
            </p>
          </div>
          {stripeReady ? (
            <>
              {!webhookReady ? (
                <p className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  Warning: <code>STRIPE_WEBHOOK_SECRET</code> is missing. Checkout
                  may not flip plan status until the webhook is configured (see{" "}
                  <code>docs/DEPLOY.md</code>).
                </p>
              ) : null}
              {session.profile.role === "owner" ? (
                <>
                  <form action={createCheckoutSession}>
                    <Button type="submit" className="w-full sm:w-auto">
                      Upgrade with Stripe Checkout
                    </Button>
                  </form>
                  {session.org.stripe_customer_id ? (
                    <form action={createBillingPortalSession}>
                      <Button
                        type="submit"
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        Open customer portal
                      </Button>
                    </form>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ask an organization owner to upgrade the plan.
                </p>
              )}
            </>
          ) : bypassAllowed && session.profile.role === "owner" ? (
            <form action={activateProDev}>
              <Button type="submit" className="w-full sm:w-auto">
                Activate Pro (dev)
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Local bypass only. Missing Stripe vars:{" "}
                <code>{missing.join(", ") || "none"}</code>. Never available in
                production.
              </p>
            </form>
          ) : (
            <div className="rounded-md border border-white/10 bg-black/30 px-3 py-3 text-sm text-muted-foreground">
              {bypassAllowed ? null : (
                <p>
                  Stripe Checkout is required. Configure{" "}
                  <code>STRIPE_SECRET_KEY</code>, <code>STRIPE_PRICE_ID</code>,{" "}
                  <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>, and{" "}
                  <code>STRIPE_WEBHOOK_SECRET</code>. See{" "}
                  <code>docs/DEPLOY.md</code>.
                </p>
              )}
              {missing.length > 0 ? (
                <p className="mt-2 text-xs">
                  Missing: <code>{missing.join(", ")}</code>
                </p>
              ) : null}
            </div>
          )}
          <Button asChild variant="ghost">
            <Link href="/pricing">View pricing</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
