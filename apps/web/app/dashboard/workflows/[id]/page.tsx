import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { WorkflowCanvas } from "@/components/workflow/workflow-canvas";
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

  return (
    <WorkflowCanvas
      workflowId={workflow.id}
      initialName={workflow.name}
      initialNodes={(workflow.nodes as FlowNode[]) ?? []}
      initialEdges={(workflow.edges as FlowEdge[]) ?? []}
      initialActive={workflow.is_active}
    />
  );
}
