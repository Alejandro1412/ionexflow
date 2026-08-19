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

export default async function AuditPage() {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");
  if (!hasProductAccess(session.org.plan_status)) {
    redirect("/dashboard/billing?paywall=1");
  }

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("org_audit_events")
    .select("id, action, target_type, target_id, meta, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(80);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold glow-text">Audit log</h1>
        <p className="text-muted-foreground">
          Who changed team, billing, mailboxes, workflows, and approvals.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent admin actions</CardTitle>
          <CardDescription>
            Separate from AI execution logs — for compliance and handoffs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(events ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No audit events yet. Invites, mailbox connects, billing, and
              approvals will appear here after the business-features migration.
            </p>
          ) : (
            <ul className="space-y-3">
              {(events ?? []).map((e) => (
                <li
                  key={e.id}
                  className="rounded-md border border-white/5 bg-black/20 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-signal">{e.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[e.target_type, e.target_id].filter(Boolean).join(" · ") ||
                      "—"}
                    {e.actor_id ? ` · actor ${e.actor_id.slice(0, 8)}…` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
