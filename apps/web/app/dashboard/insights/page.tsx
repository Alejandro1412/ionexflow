import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { updateInsightStatus } from "@/actions/monitors";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function InsightsPage() {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");
  if (!hasProductAccess(session.org.plan_status)) {
    redirect("/dashboard/billing?paywall=1");
  }

  const supabase = await createClient();
  const { data: insights } = await supabase
    .from("process_insights")
    .select("id, title, suggestion, status, kind, created_at, workflow_id")
    .eq("org_id", session.org.id)
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <p className="font-display text-sm font-semibold uppercase tracking-[0.28em] text-signal">
          Learning
        </p>
        <h1 className="mt-1 font-display text-4xl font-bold glow-text">
          Insights
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Cuando rechazas o editas una salida de la IA, Ionex sugiere mejoras de
          prompt y las guarda también en Knowledge (tag <code>learning</code>).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent suggestions</CardTitle>
          <CardDescription>
            Revisa, aplica en el canvas, o descarta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(insights ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay insights. Rechaza o edita un approval para generar el
              primero.
            </p>
          ) : (
            <ul className="space-y-4">
              {(insights ?? []).map((i) => (
                <li
                  key={i.id}
                  className="rounded-lg border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{i.title}</p>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      {i.status} · {i.kind}
                    </span>
                  </div>
                  <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                    {i.suggestion}
                  </pre>
                  {i.status === "pending" ? (
                    <div className="mt-3 flex gap-2">
                      <form
                        action={async () => {
                          "use server";
                          await updateInsightStatus(i.id, "applied");
                        }}
                      >
                        <Button type="submit" size="sm">
                          Mark applied
                        </Button>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await updateInsightStatus(i.id, "dismissed");
                        }}
                      >
                        <Button type="submit" size="sm" variant="outline">
                          Dismiss
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
