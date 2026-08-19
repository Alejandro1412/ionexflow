import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { deleteMonitor } from "@/actions/monitors";
import { MonitorForm } from "@/components/monitors/monitor-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function MonitorsPage() {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");
  if (!hasProductAccess(session.org.plan_status)) {
    redirect("/dashboard/billing?paywall=1");
  }

  const supabase = await createClient();
  const [{ data: monitors }, { data: workflows }] = await Promise.all([
    supabase
      .from("business_monitors")
      .select(
        "id, name, kind, enabled, operator, threshold, metric_value, last_value, last_checked_at, last_triggered_at, check_every_minutes, workflow_id"
      )
      .eq("org_id", session.org.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("workflows")
      .select("id, name")
      .eq("org_id", session.org.id)
      .order("updated_at", { ascending: false }),
  ]);

  const wfName = new Map((workflows ?? []).map((w) => [w.id, w.name]));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <p className="font-display text-sm font-semibold uppercase tracking-[0.28em] text-signal">
          Proactive
        </p>
        <h1 className="mt-1 font-display text-4xl font-bold glow-text">
          Monitors
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Vigila métricas o fallos y dispara un workflow cuando se cruza el
          umbral — sin esperar a que alguien pulse Run.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New monitor</CardTitle>
          <CardDescription>
            Manual metric (actualízala tú), fallos de ejecución o rechazos de
            approval en una ventana de tiempo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonitorForm workflows={workflows ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active monitors</CardTitle>
        </CardHeader>
        <CardContent>
          {(monitors ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {(monitors ?? []).map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-4 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {m.name}{" "}
                      <span className="text-xs text-muted-foreground">
                        {m.enabled ? "on" : "off"} · {m.kind}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.operator} {m.threshold} · every {m.check_every_minutes}
                      m · workflow: {wfName.get(m.workflow_id ?? "") ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      last value: {m.last_value ?? "—"} · last trigger:{" "}
                      {m.last_triggered_at
                        ? new Date(m.last_triggered_at).toLocaleString()
                        : "never"}
                    </p>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await deleteMonitor(m.id);
                    }}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      Delete
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
