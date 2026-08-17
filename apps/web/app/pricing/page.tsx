import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "IonexFlow pricing — start on a free trial, upgrade for production billing and higher limits.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 py-16">
      <div className="text-center">
        <Link href="/" className="font-display text-2xl font-bold glow-text">
          IonexFlow
        </Link>
        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight">Pricing</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Start on a free trial. Upgrade when you need production billing and higher limits.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Trial</CardTitle>
            <CardDescription>Included on signup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-display text-3xl font-bold">$0</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Workflow canvas</li>
              <li>Execution engine + logs</li>
              <li>Human approval gates</li>
              <li>Mobile companion inbox</li>
            </ul>
            <Button asChild className="w-full">
              <Link href="/signup">Start free trial</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-signal/30 shadow-[0_0_40px_rgba(61,255,242,0.12)]">
          <CardHeader>
            <CardTitle>Pro</CardTitle>
            <CardDescription>Stripe subscription</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-display text-3xl font-bold">
              Custom <span className="text-base font-normal text-muted-foreground">/ mo</span>
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Everything in Trial</li>
              <li>Stripe-managed billing status</li>
              <li>Customer portal</li>
              <li>Production-ready plan sync</li>
            </ul>
            <Button asChild className="w-full">
              <Link href="/dashboard/billing">Go to billing</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
