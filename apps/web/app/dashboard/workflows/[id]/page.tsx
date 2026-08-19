import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { getAiRuntimeStatus } from "@/lib/ai/status";
import { WorkflowCanvasLazy } from "@/components/workflow/workflow-canvas-lazy";
import type { FlowEdge, FlowNode } from "@/lib/workflow/types";

export default async function WorkflowEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");
  if (!hasProductAccess(session.org.plan_status)) redirect("/dashboard/billing?paywall=1");

  const supabase = await createClient();
  const { data: workflow } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!workflow) notFound();

  const { data: versions } = await supabase
    .from("workflow_versions")
    .select("id, version, name, created_at")
    .eq("workflow_id", workflow.id)
    .order("version", { ascending: false })
    .limit(20);

  const ai = getAiRuntimeStatus();

  return (
    <WorkflowCanvasLazy
      workflowId={workflow.id}
      initialName={workflow.name}
      initialNodes={(workflow.nodes as FlowNode[]) ?? []}
      initialEdges={(workflow.edges as FlowEdge[]) ?? []}
      initialActive={workflow.is_active}
      initialScheduleEnabled={Boolean(
        (workflow as { schedule_enabled?: boolean }).schedule_enabled
      )}
      initialScheduleEveryMinutes={
        (workflow as { schedule_every_minutes?: number | null })
          .schedule_every_minutes ?? 60
      }
      initialVersions={versions ?? []}
      aiStatus={{ live: ai.live, label: ai.label, hint: ai.hint }}
    />
  );
}
