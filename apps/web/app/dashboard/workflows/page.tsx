import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { createWorkflow, deleteWorkflow } from "@/actions/workflows";
import { BuildFromTextForm } from "@/components/workflow/build-from-text-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function WorkflowsPage() {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");
  if (!hasProductAccess(session.org.plan_status)) {
    redirect("/dashboard/billing?paywall=1");
  }

  const supabase = await createClient();
  const { data: workflows } = await supabase
    .from("workflows")
    .select("id, name, is_active, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold glow-text">
            Workflows
          </h1>
          <p className="text-muted-foreground">
            Ármalos a mano en el canvas, o descríbelos en español y la IA
            construye el diagrama por ti.
          </p>
        </div>
        <form action={createWorkflow}>
          <Button type="submit" variant="outline">
            Nuevo en blanco (manual)
          </Button>
        </form>
      </div>

      <Card className="border-signal/40 bg-signal/5">
        <CardHeader>
          <CardTitle>Descríbelo y te lo armo</CardTitle>
          <CardDescription>
            Escribe el proceso como se lo explicarías a un colega. La IA genera
            el grafo completo (borrador inactivo) listo para revisar, Test run y
            activar. También está en AI Automations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BuildFromTextForm />
        </CardContent>
      </Card>

      <div className="grid gap-3">
        <h2 className="font-display text-xl font-semibold">Tus workflows</h2>
        {(workflows ?? []).length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Aún no hay workflows</CardTitle>
              <CardDescription>
                Usa el cuadro de arriba para generar uno con IA, o{" "}
                <span className="text-foreground">Nuevo en blanco</span> para
                arrastrar nodos a mano.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          (workflows ?? []).map((wf) => (
            <Card key={wf.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <Link
                    href={`/dashboard/workflows/${wf.id}`}
                    className="font-display text-lg font-semibold hover:text-signal"
                  >
                    {wf.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {wf.is_active ? "Active" : "Inactive"} · updated{" "}
                    {new Date(wf.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/workflows/${wf.id}`}>Edit</Link>
                  </Button>
                  <form
                    action={async () => {
                      "use server";
                      await deleteWorkflow(wf.id);
                    }}
                  >
                    <Button type="submit" variant="ghost" size="sm">
                      Delete
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
