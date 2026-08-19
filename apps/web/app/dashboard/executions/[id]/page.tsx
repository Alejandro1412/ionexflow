import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { resolveApproval } from "@/actions/executions";
import { AgentOutputPanel } from "@/components/ai/agent-output";
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
      payload: {
        message?: string;
        label?: string;
        agentOutput?: string | null;
        agentLabel?: string | null;
        model?: string | null;
        provider?: string | null;
        latencyMs?: number | null;
      };
    }>) ?? [];
  const pending = approvals.find((a) => a.status === "pending");
  const agentLogs = logs.filter((l) => l.kind === "agent_output" && l.output);
  const httpLogs = logs.filter((l) => l.kind === "http_output");

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
          <CardContent className="space-y-4">
            {pending.payload?.agentOutput ? (
              <AgentOutputPanel
                title={pending.payload.agentLabel ?? "Agent output to review"}
                output={pending.payload.agentOutput}
                model={pending.payload.model}
                provider={pending.payload.provider}
                latencyMs={pending.payload.latencyMs}
              />
            ) : null}
            <div className="flex gap-3">
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
            </div>
          </CardContent>
        </Card>
      ) : null}

      {agentLogs.length > 0 ? (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Agent intelligence</h2>
          {agentLogs.map((entry, i) => (
            <AgentOutputPanel
              key={`${entry.at}-agent-${i}`}
              title={`Node ${entry.nodeId}`}
              output={entry.output!}
              model={entry.model}
              provider={entry.provider}
              latencyMs={entry.latencyMs}
            />
          ))}
        </div>
      ) : null}

      {httpLogs.length > 0 ? (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Integrations</h2>
          {httpLogs.map((entry, i) => (
            <Card key={`${entry.at}-http-${i}`}>
              <CardHeader>
                <CardTitle className="text-base">
                  Node {entry.nodeId}
                  {entry.statusCode != null ? ` · HTTP ${entry.statusCode}` : ""}
                </CardTitle>
                <CardDescription>
                  {entry.message}
                  {entry.latencyMs != null ? ` · ${entry.latencyMs}ms` : ""}
                </CardDescription>
              </CardHeader>
              {entry.output ? (
                <CardContent>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/40 p-3 font-mono text-xs text-muted-foreground">
                    {entry.output}
                  </pre>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Execution timeline</CardTitle>
          <CardDescription>Chronological engine events</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-muted-foreground">No logs.</p>
          ) : (
            logs.map((entry, i) => (
              <div
                key={`${entry.at}-${i}`}
                className={`rounded-md border p-3 ${
                  entry.kind === "agent_output"
                    ? "border-signal/30 bg-signal/5"
                    : entry.kind === "http_output"
                      ? "border-sky-400/30 bg-sky-500/5"
                      : "border-white/10 bg-black/30"
                }`}
              >
                <div className="mb-1 flex justify-between text-muted-foreground">
                  <span>
                    {entry.level}
                    {entry.provider ? ` · ${entry.provider}` : ""}
                  </span>
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
