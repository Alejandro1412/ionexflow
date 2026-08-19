"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { startWorkflowRun } from "@/lib/engine/start-run";
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

export async function startExecution(
  workflowId: string,
  triggerText?: string,
  options?: { dryRun?: boolean }
) {
  const session = await requireSession();
  const supabase = await createClient();
  const dryRun = Boolean(options?.dryRun);

  const triggerPayload = {
    input: triggerText?.trim() || (dryRun ? "Test run" : "Manual run"),
    startedBy: session.profile.full_name ?? session.user.email,
    ...(dryRun ? { dryRun: true } : {}),
  };

  const { executionId } = await startWorkflowRun(supabase, {
    orgId: session.org!.id,
    workflowId,
    triggerPayload,
    requestedBy: session.profile.id,
    dryRun,
  });

  revalidatePath("/dashboard/executions");
  revalidatePath(`/dashboard/workflows/${workflowId}`);
  redirect(`/dashboard/executions/${executionId}`);
}

export async function resolveApproval(approvalId: string, decision: "approved" | "rejected") {
  await requireSession();
  const { executionId } = await resolveApprovalForCurrentUser(approvalId, decision);
  revalidatePath("/dashboard/approvals");
  revalidatePath("/dashboard/executions");
  revalidatePath(`/dashboard/executions/${executionId}`);
  redirect(`/dashboard/executions/${executionId}`);
}

/** Kept for type imports used elsewhere */
export type { FlowEdge, FlowNode };
