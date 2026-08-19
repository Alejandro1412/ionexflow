import Link from "next/link";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await getSessionProfile();
  const supabase = await createClient();

  const [{ count: workflowCount }, { count: executionCount }, { count: pendingApprovals }] =
    await Promise.all([
      supabase.from("workflows").select("*", { count: "exact", head: true }),
      supabase.from("workflow_executions").select("*", { count: "exact", head: true }),
      supabase
        .from("approvals")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

  const access = hasProductAccess(session?.org?.plan_status);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight glow-text">
          Welcome{session?.profile.full_name ? `, ${session.profile.full_name}` : ""}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Automate processes with AI agents, classifiers, and human approvals.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workflows</CardTitle>
            <CardDescription>Visual graphs in your org</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-display font-bold text-signal">
            {workflowCount ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Executions</CardTitle>
            <CardDescription>All runs so far</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-display font-bold text-arc">
            {executionCount ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending approvals</CardTitle>
            <CardDescription>Waiting on humans</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-display font-bold text-amber-300">
            {pendingApprovals ?? 0}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Tenant boundary + plan used by RLS and billing</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{session?.org?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plan status</span>
            <span className="font-medium capitalize">{session?.org?.plan_status ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your role</span>
            <span className="font-medium capitalize">{session?.profile.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Product access</span>
            <span className="font-medium">{access ? "Allowed" : "Locked"}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard/automations">AI Automations</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/workflows">Open workflows</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/approvals">Review approvals</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/billing">Billing</Link>
        </Button>
      </div>
    </div>
  );
}
