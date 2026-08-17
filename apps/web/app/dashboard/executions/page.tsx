import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ExecutionsPage() {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");
  if (!hasProductAccess(session.org.plan_status)) redirect("/dashboard/billing?paywall=1");

  const supabase = await createClient();
  const { data: executions } = await supabase
    .from("workflow_executions")
    .select("id, status, created_at, started_at, completed_at, workflow_id, workflows(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold glow-text">Executions</h1>
        <p className="text-muted-foreground">Run history and live status for your workflows.</p>
      </div>

      <div className="grid gap-3">
        {(executions ?? []).length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No runs yet</CardTitle>
              <CardDescription>Open a workflow and press Run.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          (executions ?? []).map((ex) => {
            const wfName = (ex as { workflows?: { name?: string } | null }).workflows?.name;
            return (
              <Card key={ex.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <Link
                      href={`/dashboard/executions/${ex.id}`}
                      className="font-medium hover:text-signal"
                    >
                      {wfName ?? "Workflow"} · {ex.status}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ex.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/executions/${ex.id}`}
                    className="text-sm text-signal hover:underline"
                  >
                    View logs
                  </Link>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
