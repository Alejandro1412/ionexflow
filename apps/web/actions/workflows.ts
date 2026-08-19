"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { defaultWorkflowGraph } from "@/lib/workflow/types";
import { getAutomationTemplate } from "@/lib/workflow/templates";
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
  const { session } = access as {
    session: NonNullable<Awaited<ReturnType<typeof getSessionProfile>>>;
  };
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

export async function createWorkflowFromTemplate(templateId: string) {
  const access = await requireAccess();
  if ("error" in access && access.error === "Not authenticated") {
    redirect("/login");
  }
  if ("error" in access && access.error === "upgrade_required") {
    redirect("/dashboard/billing?paywall=1");
  }
  const { session } = access as {
    session: NonNullable<Awaited<ReturnType<typeof getSessionProfile>>>;
  };

  const template = getAutomationTemplate(templateId);
  if (!template) throw new Error("Unknown template");

  const graph = template.build();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflows")
    .insert({
      org_id: session.org!.id,
      name: template.name,
      nodes: graph.nodes,
      edges: graph.edges,
      is_active: true,
      created_by: session.profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create from template");
  }

  redirect(`/dashboard/workflows/${data.id}`);
}

export async function saveWorkflow(
  workflowId: string,
  input: {
    name: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    is_active: boolean;
    schedule_enabled?: boolean;
    schedule_every_minutes?: number | null;
  }
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
  const orgId = access.session.org!.id;

  const { data: current } = await supabase
    .from("workflows")
    .select("id, org_id")
    .eq("id", workflowId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!current) return { error: "Workflow not found" };

  const { error } = await supabase
    .from("workflows")
    .update({
      name: input.name,
      nodes: input.nodes,
      edges: input.edges,
      is_active: input.is_active,
      schedule_enabled: Boolean(input.schedule_enabled),
      schedule_every_minutes: input.schedule_enabled
        ? input.schedule_every_minutes ?? 60
        : null,
    })
    .eq("id", workflowId);

  if (error) return { error: error.message };

  // Snapshot version history (best-effort; do not fail Save)
  try {
    const { data: latest } = await supabase
      .from("workflow_versions")
      .select("version")
      .eq("workflow_id", workflowId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latest?.version ?? 0) + 1;
    await supabase.from("workflow_versions").insert({
      workflow_id: workflowId,
      org_id: orgId,
      version: nextVersion,
      name: input.name,
      nodes: input.nodes,
      edges: input.edges,
      is_active: input.is_active,
      schedule_enabled: Boolean(input.schedule_enabled),
      schedule_every_minutes: input.schedule_enabled
        ? input.schedule_every_minutes ?? 60
        : null,
      created_by: access.session.profile.id,
    });

    // Keep last 50 versions
    if (nextVersion > 50) {
      await supabase
        .from("workflow_versions")
        .delete()
        .eq("workflow_id", workflowId)
        .lt("version", nextVersion - 49);
    }
  } catch {
    // table may not exist yet on older envs
  }

  revalidatePath(`/dashboard/workflows/${workflowId}`);
  revalidatePath("/dashboard/workflows");
  revalidatePath("/dashboard/automations");
  return null;
}

export async function listWorkflowVersions(workflowId: string) {
  const access = await requireAccess();
  if ("error" in access) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("workflow_versions")
    .select("id, version, name, created_at, created_by, is_active")
    .eq("workflow_id", workflowId)
    .eq("org_id", access.session.org!.id)
    .order("version", { ascending: false })
    .limit(20);

  return data ?? [];
}

export async function restoreWorkflowVersion(
  workflowId: string,
  versionId: string
): Promise<WorkflowActionState> {
  const access = await requireAccess();
  if ("error" in access) {
    return {
      error:
        access.error === "upgrade_required"
          ? "Upgrade required"
          : "Not authenticated",
    };
  }

  const supabase = await createClient();
  const { data: version } = await supabase
    .from("workflow_versions")
    .select("*")
    .eq("id", versionId)
    .eq("workflow_id", workflowId)
    .eq("org_id", access.session.org!.id)
    .maybeSingle();

  if (!version) return { error: "Version not found" };

  return saveWorkflow(workflowId, {
    name: version.name,
    nodes: version.nodes as FlowNode[],
    edges: version.edges as FlowEdge[],
    is_active: version.is_active,
    schedule_enabled: version.schedule_enabled,
    schedule_every_minutes: version.schedule_every_minutes,
  });
}

export async function deleteWorkflow(workflowId: string) {
  const access = await requireAccess();
  if ("error" in access) redirect("/dashboard/billing?paywall=1");

  const supabase = await createClient();
  await supabase.from("workflows").delete().eq("id", workflowId);
  revalidatePath("/dashboard/workflows");
  revalidatePath("/dashboard/automations");
  redirect("/dashboard/workflows");
}
