import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { getOrgQuotaSnapshot } from "@/lib/ai/usage";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ExecRow = {
  id: string;
  workflow_id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  workflows: { name: string } | null;
};

export default async function AnalyticsPage() {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");
  if (!hasProductAccess(session.org.plan_status)) {
    redirect("/dashboard/billing?paywall=1");
  }

  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60_000).toISOString();

  const { data: executions } = await supabase
    .from("workflow_executions")
    .select("id, workflow_id, status, started_at, completed_at, created_at, workflows(name)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  const { data: usageEvents } = await supabase
    .from("ai_usage_events")
    .select("total_tokens, source, created_at, meta")
    .gte("created_at", since)
    .limit(1000);

  let quotaLabel = "—";
  let overageLabel = "0";
  try {
    const { quota, org } = await getOrgQuotaSnapshot(session.org.id);
    quotaLabel = `${quota.used.toLocaleString()} / ${quota.budget.toLocaleString()} (${quota.monthKey})`;
    overageLabel = (org?.ai_overage_tokens ?? 0).toLocaleString();
  } catch {
    /* migration may be pending */
  }

  const byWorkflow = new Map<
    string,
    {
      name: string;
      total: number;
      completed: number;
      failed: number;
      paused: number;
      latencyMs: number[];
    }
  >();

  for (const row of (executions ?? []) as unknown as ExecRow[]) {
    const key = row.workflow_id;
    const name = row.workflows?.name ?? "Untitled";
    const bucket = byWorkflow.get(key) ?? {
      name,
      total: 0,
      completed: 0,
      failed: 0,
      paused: 0,
      latencyMs: [],
    };
    bucket.total += 1;
    if (row.status === "completed") bucket.completed += 1;
    if (row.status === "failed") bucket.failed += 1;
    if (row.status === "paused" || row.status === "running") bucket.paused += 1;
    if (row.started_at && row.completed_at) {
      const ms =
        new Date(row.completed_at).getTime() -
        new Date(row.started_at).getTime();
      if (ms >= 0 && ms < 86_400_000) bucket.latencyMs.push(ms);
    }
    byWorkflow.set(key, bucket);
  }

  const rows = [...byWorkflow.entries()]
    .map(([id, b]) => {
      const avgLatency =
        b.latencyMs.length > 0
          ? Math.round(
              b.latencyMs.reduce((a, c) => a + c, 0) / b.latencyMs.length
            )
          : null;
      const successRate =
        b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0;
      return { id, ...b, avgLatency, successRate };
    })
    .sort((a, b) => b.total - a.total);

  const tokens30d = (usageEvents ?? []).reduce(
    (sum, e) => sum + Number((e as { total_tokens?: number }).total_tokens ?? 0),
    0
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold glow-text">Analytics</h1>
        <p className="text-muted-foreground">
          Last 30 days — reliability and AI cost signals per workflow.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Runs (30d)</CardDescription>
            <CardTitle className="text-2xl">{executions?.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>AI tokens (30d events)</CardDescription>
            <CardTitle className="text-2xl">
              {tokens30d.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Month quota / overage</CardDescription>
            <CardTitle className="text-lg">{quotaLabel}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Overage tokens: {overageLabel}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By workflow</CardTitle>
          <CardDescription>
            Success rate, failures, and average completion latency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No executions in the last 30 days.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Workflow</th>
                    <th className="py-2 pr-3">Runs</th>
                    <th className="py-2 pr-3">Success</th>
                    <th className="py-2 pr-3">Failed</th>
                    <th className="py-2 pr-3">Open</th>
                    <th className="py-2">Avg latency</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-white/5">
                      <td className="py-2 pr-3 font-medium">{r.name}</td>
                      <td className="py-2 pr-3">{r.total}</td>
                      <td className="py-2 pr-3 text-signal">
                        {r.successRate}%
                      </td>
                      <td className="py-2 pr-3">{r.failed}</td>
                      <td className="py-2 pr-3">{r.paused}</td>
                      <td className="py-2">
                        {r.avgLatency != null
                          ? `${(r.avgLatency / 1000).toFixed(1)}s`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
