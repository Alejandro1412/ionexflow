"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { runWorkflowGraph } from "@/lib/engine/runner";
import { resolveApprovalForCurrentUser } from "@/lib/engine/approvals";
import type { FlowEdge, FlowNode } from "@/lib/workflow/types";

async function requireSession() {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");
  if (!hasProductAccess(session.org.plan_status)) {
    redirect("/dashboard/billing?paywall=1");
  }
  return session;
}

export async function startExecution(workflowId: string, triggerText?: string) {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: workflow } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .single();

  if (!workflow) throw new Error("Workflow not found");

  const nodes = (workflow.nodes as FlowNode[]) ?? [];
  const edges = (workflow.edges as FlowEdge[]) ?? [];
  const triggerPayload = {
    input: triggerText?.trim() || "Manual run",
    startedBy: session.profile.full_name ?? session.user.email,
  };

  const { data: execution, error } = await supabase
    .from("workflow_executions")
    .insert({
      workflow_id: workflowId,
      org_id: session.org!.id,
      status: "running",
      trigger_payload: triggerPayload,
      logs: [],
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !execution) throw new Error(error?.message ?? "Failed to start");

  const result = runWorkflowGraph({ nodes, edges, triggerPayload });

  if (result.kind === "paused") {
    await supabase
      .from("workflow_executions")
      .update({ status: "paused", logs: result.logs })
      .eq("id", execution.id);

    await supabase.from("approvals").insert({
      execution_id: execution.id,
      org_id: session.org!.id,
      node_id: result.approvalNodeId,
      status: "pending",
      requested_by: session.profile.id,
      payload: result.approvalPayload,
    });
  } else if (result.kind === "completed") {
    await supabase
      .from("workflow_executions")
      .update({
        status: "completed",
        logs: result.logs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", execution.id);
  } else {
    await supabase
      .from("workflow_executions")
      .update({
        status: "failed",
        logs: result.logs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", execution.id);
  }

  revalidatePath("/dashboard/executions");
  revalidatePath(`/dashboard/workflows/${workflowId}`);
  redirect(`/dashboard/executions/${execution.id}`);
}

export async function resolveApproval(approvalId: string, decision: "approved" | "rejected") {
  await requireSession();
  const { executionId } = await resolveApprovalForCurrentUser(approvalId, decision);
  revalidatePath("/dashboard/approvals");
  revalidatePath("/dashboard/executions");
  revalidatePath(`/dashboard/executions/${executionId}`);
  redirect(`/dashboard/executions/${executionId}`);
}
