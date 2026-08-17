import Link from "next/link";
import { redirect } from "next/navigation";
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
          Human-in-the-loop gates. Also available in the mobile companion via Realtime.
        </p>
      </div>

      <div className="grid gap-3">
        {(approvals ?? []).length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Inbox empty</CardTitle>
              <CardDescription>Run a workflow that includes an Approval node.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          (approvals ?? []).map((item) => {
            const payload = (item.payload ?? {}) as { message?: string; label?: string };
            return (
              <Card key={item.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-medium">
                      {payload.label ?? item.node_id} · {item.status}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {payload.message ?? "No message"}
                    </p>
                    <Link
                      href={`/dashboard/executions/${item.execution_id}`}
                      className="text-xs text-signal hover:underline"
                    >
                      Open execution
                    </Link>
                  </div>
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
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
