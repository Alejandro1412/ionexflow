"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { defaultWorkflowGraph } from "@/lib/workflow/types";
import type { FlowEdge, FlowNode } from "@/lib/workflow/types";

export type WorkflowActionState = { error?: string } | null;

async function requireAccess() {
  const session = await getSessionProfile();
  if (!session?.org) return { error: "Not authenticated" as const };
  if (!hasProductAccess(session.org.plan_status)) {
    return { error: "upgrade_required" as const, session };
  }
  return { session };
}

export async function createWorkflow() {
  const access = await requireAccess();
  if ("error" in access && access.error === "Not authenticated") {
    redirect("/login");
  }
  if ("error" in access && access.error === "upgrade_required") {
    redirect("/dashboard/billing?paywall=1");
  }
  const { session } = access as { session: NonNullable<Awaited<ReturnType<typeof getSessionProfile>>> };
  const graph = defaultWorkflowGraph();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workflows")
    .insert({
      org_id: session.org!.id,
      name: "Untitled workflow",
      nodes: graph.nodes,
      edges: graph.edges,
      is_active: true,
      created_by: session.profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create workflow");
  }

  redirect(`/dashboard/workflows/${data.id}`);
}

export async function saveWorkflow(
  workflowId: string,
  input: { name: string; nodes: FlowNode[]; edges: FlowEdge[]; is_active: boolean }
): Promise<WorkflowActionState> {
  const access = await requireAccess();
  if ("error" in access) {
    return {
      error:
        access.error === "upgrade_required"
          ? "Upgrade required to edit workflows"
          : "Not authenticated",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("workflows")
    .update({
      name: input.name,
      nodes: input.nodes,
      edges: input.edges,
      is_active: input.is_active,
    })
    .eq("id", workflowId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/workflows/${workflowId}`);
  revalidatePath("/dashboard/workflows");
  return null;
}

export async function deleteWorkflow(workflowId: string) {
  const access = await requireAccess();
  if ("error" in access) redirect("/dashboard/billing?paywall=1");

  const supabase = await createClient();
  await supabase.from("workflows").delete().eq("id", workflowId);
  revalidatePath("/dashboard/workflows");
  redirect("/dashboard/workflows");
}
