"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { writeAuditEvent } from "@/lib/audit";

export type MonitorActionState = { ok?: boolean; error?: string };

async function requireOrg() {
  const session = await getSessionProfile();
  if (!session?.org) throw new Error("Not authenticated");
  if (!hasProductAccess(session.org.plan_status)) {
    throw new Error("Upgrade required");
  }
  return session;
}

export async function upsertMonitor(
  _prev: MonitorActionState | null,
  formData: FormData
): Promise<MonitorActionState> {
  try {
    const session = await requireOrg();
    const supabase = await createClient();
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    const kind = String(formData.get("kind") ?? "manual_metric").trim();
    const operator = String(formData.get("operator") ?? "gte").trim();
    const threshold = Number(formData.get("threshold") ?? 1);
    const metric_value = Number(formData.get("metric_value") ?? 0);
    const window_hours = Number(formData.get("window_hours") ?? 168);
    const check_every_minutes = Math.max(
      5,
      Number(formData.get("check_every_minutes") ?? 60)
    );
    const workflow_id =
      String(formData.get("workflow_id") ?? "").trim() || null;
    const notify_message =
      String(formData.get("notify_message") ?? "").trim() || null;
    const enabled = formData.get("enabled") === "on" || formData.get("enabled") === "true";

    if (!name) return { ok: false, error: "Name required" };
    if (!workflow_id) return { ok: false, error: "Link a workflow to run" };

    const row = {
      org_id: session.org!.id,
      name,
      description,
      kind,
      operator,
      threshold,
      metric_value,
      window_hours,
      check_every_minutes,
      workflow_id,
      notify_message,
      enabled,
      updated_at: new Date().toISOString(),
      created_by: session.profile.id,
    };

    if (id) {
      const { error } = await supabase
        .from("business_monitors")
        .update(row)
        .eq("id", id)
        .eq("org_id", session.org!.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from("business_monitors").insert(row);
      if (error) return { ok: false, error: error.message };
    }

    await writeAuditEvent({
      orgId: session.org!.id,
      actorId: session.profile.id,
      action: id ? "monitor.updated" : "monitor.created",
      targetType: "business_monitor",
      targetId: id || null,
      meta: { name, kind },
    });

    revalidatePath("/dashboard/monitors");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed",
    };
  }
}

export async function deleteMonitor(id: string) {
  const session = await requireOrg();
  const supabase = await createClient();
  await supabase
    .from("business_monitors")
    .delete()
    .eq("id", id)
    .eq("org_id", session.org!.id);
  revalidatePath("/dashboard/monitors");
}

export async function updateInsightStatus(
  id: string,
  status: "dismissed" | "applied" | "pending"
) {
  const session = await requireOrg();
  const supabase = await createClient();
  await supabase
    .from("process_insights")
    .update({ status })
    .eq("id", id)
    .eq("org_id", session.org!.id);
  revalidatePath("/dashboard/insights");
}
