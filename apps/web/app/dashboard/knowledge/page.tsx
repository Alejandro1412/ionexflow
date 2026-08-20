import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import {
  deleteKnowledgeDocument,
  reindexAllKnowledge,
  seedStarterKnowledge,
} from "@/actions/knowledge";
import { KnowledgeForm } from "@/components/knowledge/knowledge-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function KnowledgePage() {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");
  if (!hasProductAccess(session.org.plan_status)) {
    redirect("/dashboard/billing?paywall=1");
  }

  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("document_knowledge")
    .select("id, title, tags, doc_kind, created_at, updated_at, content")
    .eq("org_id", session.org.id)
    .order("updated_at", { ascending: false })
    .limit(60);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <p className="font-display text-sm font-semibold uppercase tracking-[0.28em] text-signal">
          Company brain
        </p>
        <h1 className="mt-1 font-display text-4xl font-bold glow-text">
          Knowledge
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Esto es lo que separa un chatbot genérico de un empleado que conoce tu
          negocio. Sube políticas, catálogo, contratos y FAQs: cada Agent (con
          Knowledge ON) busca trozos relevantes y, si hay historial con ese
          cliente (email/WhatsApp), también lo inyecta.
        </p>
      </div>

      <Card className="border-signal/30 bg-signal/5">
        <CardHeader>
          <CardTitle>Alimentar a la IA</CardTitle>
          <CardDescription>
            Archivo o texto. Se parte en chunks y se rankea por relevancia en
            cada run — no solo “el mensaje que llegó”.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KnowledgeForm />
        </CardContent>
      </Card>

      {(docs ?? []).length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Empieza con plantillas</CardTitle>
            <CardDescription>
              Crea docs de ejemplo (política de soporte + catálogo) y edítalos
              con tu realidad.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={seedStarterKnowledge}>
              <Button type="submit">Crear plantillas de Knowledge</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Biblioteca</h2>
          {(docs ?? []).length > 0 ? (
            <form action={reindexAllKnowledge}>
              <Button type="submit" size="sm" variant="outline">
                Reindexar chunks
              </Button>
            </form>
          ) : null}
        </div>
        {(docs ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún vacío. Sube tu primer documento arriba.
          </p>
        ) : (
          <ul className="space-y-3">
            {(docs ?? []).map((d) => (
              <li
                key={d.id}
                className="rounded-lg border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.doc_kind || "general"} · {d.tags || "—"} ·{" "}
                      {new Date(d.updated_at).toLocaleString()} ·{" "}
                      {String(d.content).length.toLocaleString()} chars
                    </p>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await deleteKnowledgeDocument(d.id);
                    }}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      Delete
                    </Button>
                  </form>
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {String(d.content).slice(0, 280)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
