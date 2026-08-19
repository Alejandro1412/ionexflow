import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { getAiRuntimeStatus } from "@/lib/ai/status";
import { AGENT_MODE_META, type AgentMode } from "@/lib/ai/modes";
import { AUTOMATION_TEMPLATES } from "@/lib/workflow/templates";
import { createWorkflowFromTemplate } from "@/actions/workflows";
import { AiLabForm } from "@/components/ai/ai-lab-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "AI Automations",
  robots: { index: false, follow: false },
};

export default async function AutomationsPage() {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");
  if (!hasProductAccess(session.org.plan_status)) redirect("/dashboard/billing?paywall=1");

  const ai = getAiRuntimeStatus();
  const modes = Object.keys(AGENT_MODE_META) as AgentMode[];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="space-y-3">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.28em] text-signal">
          Command · Intelligence
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight glow-text">
          AI Automations
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Diseña procesos que la IA ejecuta por ti: research, copy, soporte, ventas y ops —
          con clasificadores que ramifican y approvals humanos donde importa.
        </p>
        <div
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
            ai.live
              ? "border-signal/40 bg-signal/10 text-signal"
              : "border-amber-400/40 bg-amber-500/10 text-amber-100"
          }`}
        >
          {ai.label}
        </div>
        <p className="text-sm text-muted-foreground">{ai.hint}</p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">Process templates</h2>
          <p className="text-sm text-muted-foreground">
            Un clic crea el grafo completo listo para Run con tu brief.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {AUTOMATION_TEMPLATES.map((template) => (
            <Card key={template.id} className="border-white/10 bg-black/20">
              <CardHeader>
                <p className="text-[11px] uppercase tracking-widest text-signal">
                  {template.category}
                </p>
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <CardDescription>{template.blurb}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="rounded-md border border-white/10 bg-black/30 p-3 text-xs text-muted-foreground">
                  Trigger tip: {template.triggerHint}
                </p>
                <form
                  action={async () => {
                    "use server";
                    await createWorkflowFromTemplate(template.id);
                  }}
                >
                  <Button type="submit" className="w-full">
                    Use this automation
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">Agent playbooks</h2>
          <p className="text-sm text-muted-foreground">
            Cada modo cambia el system prompt y el estilo de automatización.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {modes.map((mode) => (
            <div
              key={mode}
              className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4"
            >
              <p className="font-display text-sm font-semibold text-signal">
                {AGENT_MODE_META[mode].label}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {AGENT_MODE_META[mode].description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">AI Lab</h2>
          <p className="text-sm text-muted-foreground">
            Prueba un playbook al instante sin armar un workflow. Ideal para iterar prompts.
          </p>
        </div>
        <Card className="border-signal/20">
          <CardContent className="pt-6">
            <AiLabForm />
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap gap-3 pb-8">
        <Button asChild variant="outline">
          <Link href="/dashboard/workflows">Open canvas</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/approvals">Approvals inbox</Link>
        </Button>
      </div>
    </div>
  );
}
