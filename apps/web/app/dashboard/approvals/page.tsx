import Link from "next/link";
import { redirect } from "next/navigation";
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

type ApprovalPayload = {
  message?: string;
  label?: string;
  agentOutput?: string | null;
  agentLabel?: string | null;
  model?: string | null;
  provider?: string | null;
  latencyMs?: number | null;
};

export default async function ApprovalsPage() {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");
  if (!hasProductAccess(session.org.plan_status)) redirect("/dashboard/billing?paywall=1");

  const supabase = await createClient();
  const { data: approvals } = await supabase
    .from("approvals")
    .select("id, status, node_id, payload, created_at, execution_id")
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold glow-text">Approvals</h1>
        <p className="text-muted-foreground">
          Review live agent intelligence before the workflow continues. Also on mobile via Realtime.
        </p>
      </div>

      <div className="grid gap-4">
        {(approvals ?? []).length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Inbox empty</CardTitle>
              <CardDescription>
                Run the default Research → Draft → Approval workflow to see AI output here.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          (approvals ?? []).map((item) => {
            const payload = (item.payload ?? {}) as ApprovalPayload;
            return (
              <Card key={item.id} className="overflow-hidden border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">
                    {payload.label ?? item.node_id} · {item.status}
                  </CardTitle>
                  <CardDescription>{payload.message ?? "No message"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {payload.agentOutput ? (
                    <AgentOutputPanel
                      title={payload.agentLabel ?? "Upstream agent"}
                      output={payload.agentOutput}
                      model={payload.model}
                      provider={payload.provider}
                      latencyMs={payload.latencyMs}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No agent output attached to this gate.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                      href={`/dashboard/executions/${item.execution_id}`}
                      className="text-xs text-signal hover:underline"
                    >
                      Open execution
                    </Link>
                    {item.status === "pending" ? (
                      <div className="flex gap-2">
                        <form
                          action={async () => {
                            "use server";
                            await resolveApproval(item.id, "approved");
                          }}
                        >
                          <Button type="submit" size="sm">
                            Approve
                          </Button>
                        </form>
                        <form
                          action={async () => {
                            "use server";
                            await resolveApproval(item.id, "rejected");
                          }}
                        >
                          <Button type="submit" size="sm" variant="outline">
                            Reject
                          </Button>
                        </form>
                      </div>
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
