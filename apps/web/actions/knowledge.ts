"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { writeAuditEvent } from "@/lib/audit";

export type KnowledgeActionState = { ok?: boolean; error?: string };

async function requireOrg() {
  const session = await getSessionProfile();
  if (!session?.org) throw new Error("Not authenticated");
  if (!hasProductAccess(session.org.plan_status)) {
    throw new Error("Upgrade required");
  }
  return session;
}

export async function upsertKnowledgeDocument(
  _prev: KnowledgeActionState | null,
  formData: FormData
): Promise<KnowledgeActionState> {
  try {
    const session = await requireOrg();
    const supabase = await createClient();
    const id = String(formData.get("id") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();
    const tags = String(formData.get("tags") ?? "").trim() || null;

    if (!title || !content) {
      return { ok: false, error: "Title and content are required" };
    }
    if (content.length > 100_000) {
      return { ok: false, error: "Content too large (max ~100k chars)" };
    }

    if (id) {
      const { error } = await supabase
        .from("document_knowledge")
        .update({
          title,
          content,
          tags,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("org_id", session.org!.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from("document_knowledge").insert({
        org_id: session.org!.id,
        title,
        content,
        tags,
        created_by: session.profile.id,
      });
      if (error) return { ok: false, error: error.message };
    }

    await writeAuditEvent({
      orgId: session.org!.id,
      actorId: session.profile.id,
      action: id ? "knowledge.updated" : "knowledge.created",
      targetType: "document_knowledge",
      targetId: id || undefined,
      meta: { title },
    });

    revalidatePath("/dashboard/knowledge");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Save failed",
    };
  }
}

export async function deleteKnowledgeDocument(docId: string) {
  const session = await requireOrg();
  const supabase = await createClient();
  await supabase
    .from("document_knowledge")
    .delete()
    .eq("id", docId)
    .eq("org_id", session.org!.id);
  await writeAuditEvent({
    orgId: session.org!.id,
    actorId: session.profile.id,
    action: "knowledge.deleted",
    targetType: "document_knowledge",
    targetId: docId,
  });
  revalidatePath("/dashboard/knowledge");
}
