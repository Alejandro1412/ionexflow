import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { resolveApproval } from "@/actions/executions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExecutionLogEntry } from "@/lib/workflow/types";

export default async function ExecutionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");
  if (!hasProductAccess(session.org.plan_status)) redirect("/dashboard/billing?paywall=1");

  const supabase = await createClient();
  const { data: execution } = await supabase
    .from("workflow_executions")
    .select("*, workflows(name), approvals(*)")
    .eq("id", params.id)
    .single();

  if (!execution) notFound();

  const logs = (execution.logs as ExecutionLogEntry[]) ?? [];
  const approvals =
    ((execution as { approvals?: Array<Record<string, unknown>> }).approvals as Array<{
      id: string;
      status: string;
      node_id: string;
      payload: { message?: string; label?: string };
    }>) ?? [];
  const pending = approvals.find((a) => a.status === "pending");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/executions" className="hover:text-signal">
            Executions
          </Link>
        </p>
        <h1 className="font-display text-3xl font-bold glow-text">
          {(execution as { workflows?: { name?: string } }).workflows?.name ?? "Run"} ·{" "}
          {execution.status}
        </h1>
      </div>

      {pending ? (
        <Card className="border-amber-400/40">
          <CardHeader>
            <CardTitle>Pending approval</CardTitle>
            <CardDescription>
              {pending.payload?.message ?? pending.payload?.label ?? pending.node_id}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <form
              action={async () => {
                "use server";
                await resolveApproval(pending.id, "approved");
              }}
            >
              <Button type="submit">Approve & resume</Button>
            </form>
            <form
              action={async () => {
                "use server";
                await resolveApproval(pending.id, "rejected");
              }}
            >
              <Button type="submit" variant="outline">
                Reject
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Execution logs</CardTitle>
          <CardDescription>Chronological engine output</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-muted-foreground">No logs.</p>
          ) : (
            logs.map((entry, i) => (
              <div
                key={`${entry.at}-${i}`}
                className="rounded-md border border-white/10 bg-black/30 p-3"
              >
                <div className="mb-1 flex justify-between text-muted-foreground">
                  <span>{entry.level}</span>
                  <span>{new Date(entry.at).toLocaleTimeString()}</span>
                </div>
                <p className="text-foreground">{entry.message}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
