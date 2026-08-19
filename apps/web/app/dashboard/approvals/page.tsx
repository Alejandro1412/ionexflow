import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { AgentOutputPanel } from "@/components/ai/agent-output";
import { ApprovalActions } from "@/components/approvals/approval-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ApprovalPayload = {
  message?: string;
  label?: string;
  agentOutput?: string | null;
  agentLabel?: string | null;
  model?: string | null;
  provider?: string | null;
  latencyMs?: number | null;
  slaMinutes?: number | null;
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams?: { slack?: string };
}) {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");
  if (!hasProductAccess(session.org.plan_status)) redirect("/dashboard/billing?paywall=1");

  const supabase = await createClient();
  const { data: approvals } = await supabase
    .from("approvals")
    .select(
      "id, status, node_id, payload, created_at, execution_id, escalate_at, escalated_at, edited_output"
    )
    .order("created_at", { ascending: false })
    .limit(40);

  const slackNote = searchParams?.slack;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold glow-text">Approvals</h1>
        <p className="text-muted-foreground">
          Review and optionally edit agent output before the workflow continues.
          Slack buttons and mobile Realtime also work here.
        </p>
      </div>

      {slackNote === "approved" || slackNote === "rejected" ? (
        <div className="rounded-lg border border-signal/40 bg-signal/10 px-4 py-2 text-sm">
          Slack decision recorded: {slackNote}.
        </div>
      ) : null}
      {slackNote === "invalid" || slackNote === "error" ? (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm">
          Slack link expired or failed — open the approval below and decide in the app.
        </div>
      ) : null}

      <div className="grid gap-4">
        {(approvals ?? []).length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Inbox empty</CardTitle>
              <CardDescription>
                Run a workflow with an Approval node to see AI output here.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          (approvals ?? []).map((item) => {
            const payload = (item.payload ?? {}) as ApprovalPayload;
            const row = item as {
              escalate_at?: string | null;
              escalated_at?: string | null;
              edited_output?: string | null;
            };
            return (
              <Card key={item.id} className="overflow-hidden border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">
                    {payload.label ?? item.node_id} · {item.status}
                  </CardTitle>
                  <CardDescription>
                    {payload.message ?? "No message"}
                    {row.escalate_at
                      ? ` · SLA ${new Date(row.escalate_at).toLocaleString()}`
                      : ""}
                    {row.escalated_at ? " · escalated" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {payload.agentOutput || row.edited_output ? (
                    <AgentOutputPanel
                      title={payload.agentLabel ?? "Upstream agent"}
                      output={row.edited_output ?? payload.agentOutput ?? ""}
                      model={payload.model}
                      provider={
                        row.edited_output ? "human-edit" : payload.provider
                      }
                      latencyMs={payload.latencyMs}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No agent output attached to this gate.
                    </p>
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <Link
                      href={`/dashboard/executions/${item.execution_id}`}
                      className="text-xs text-signal hover:underline"
                    >
                      Open execution
                    </Link>
                    {item.status === "pending" ? (
                      <ApprovalActions
                        approvalId={item.id}
                        initialOutput={payload.agentOutput}
                      />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
