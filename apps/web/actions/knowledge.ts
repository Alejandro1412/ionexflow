"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { writeAuditEvent } from "@/lib/audit";
import { reindexDocumentChunks, extractTextFromUpload } from "@/lib/knowledge/index-doc";

export type KnowledgeActionState = { ok?: boolean; error?: string };

const DOC_KINDS = new Set([
  "general",
  "policy",
  "catalog",
  "contract",
  "playbook",
  "customer",
  "faq",
]);

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
    let title = String(formData.get("title") ?? "").trim();
    let content = String(formData.get("content") ?? "").trim();
    const tags = String(formData.get("tags") ?? "").trim() || null;
    const rawKind = String(formData.get("doc_kind") ?? "general").trim();
    const doc_kind = DOC_KINDS.has(rawKind) ? rawKind : "general";

    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      if (file.size > 8_000_000) {
        return { ok: false, error: "Archivo demasiado grande (máx. 8 MB)" };
      }
      const extracted = await extractTextFromUpload(file);
      content = extracted.text.trim();
      if (!title) title = extracted.titleHint || file.name;
    }

    if (!title || !content) {
      return {
        ok: false,
        error: "Título y contenido (o archivo) son obligatorios",
      };
    }
    if (content.length > 200_000) {
      return { ok: false, error: "Contenido demasiado grande (máx. ~200k chars)" };
    }

    let documentId = id;

    if (id) {
      const { error } = await supabase
        .from("document_knowledge")
        .update({
          title,
          content,
          tags,
          doc_kind,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("org_id", session.org!.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { data, error } = await supabase
        .from("document_knowledge")
        .insert({
          org_id: session.org!.id,
          title,
          content,
          tags,
          doc_kind,
          created_by: session.profile.id,
        })
        .select("id")
        .single();
      if (error || !data) {
        return { ok: false, error: error?.message ?? "Save failed" };
      }
      documentId = data.id;
    }

    await reindexDocumentChunks({
      orgId: session.org!.id,
      documentId,
      content,
    });

    await writeAuditEvent({
      orgId: session.org!.id,
      actorId: session.profile.id,
      action: id ? "knowledge.updated" : "knowledge.created",
      targetType: "document_knowledge",
      targetId: documentId || undefined,
      meta: { title, doc_kind },
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

/** One-click starter docs so orgs aren't empty. */
export async function seedStarterKnowledge() {
  const session = await requireOrg();
  const supabase = await createClient();
  const starters = [
    {
      title: "Política de soporte (plantilla)",
      doc_kind: "policy",
      tags: "soporte,plantilla",
      content: [
        "Horario de atención: lun–vie 9:00–18:00 (hora local).",
        "SLA respuesta inicial: 4 horas laborables.",
        "Reembolsos: solo con ticket aprobado por finanzas; plazo 14 días.",
        "Tono: empático, claro, sin promesas que no podamos cumplir.",
        "Escalar a humano si: amenaza legal, datos personales sensibles, o cliente Enterprise furioso.",
      ].join("\n"),
    },
    {
      title: "Catálogo / ofertas (plantilla)",
      doc_kind: "catalog",
      tags: "ventas,plantilla",
      content: [
        "Producto A — plan Starter: automatizaciones básicas, 1 canal.",
        "Producto B — plan Pro: WhatsApp + Knowledge + approvals.",
        "Descuentos: máximo 15% con aprobación de ventas.",
        "No inventar precios; si falta dato, pedir confirmación humana.",
      ].join("\n"),
    },
  ];

  for (const s of starters) {
    const { data } = await supabase
      .from("document_knowledge")
      .insert({
        org_id: session.org!.id,
        title: s.title,
        content: s.content,
        tags: s.tags,
        doc_kind: s.doc_kind,
        created_by: session.profile.id,
      })
      .select("id")
      .single();
    if (data?.id) {
      await reindexDocumentChunks({
        orgId: session.org!.id,
        documentId: data.id,
        content: s.content,
      });
    }
  }

  revalidatePath("/dashboard/knowledge");
}

/** Re-index all org docs into chunks (after applying knowledge v2 SQL). */
export async function reindexAllKnowledge() {
  const session = await requireOrg();
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("document_knowledge")
    .select("id, content")
    .eq("org_id", session.org!.id);
  for (const d of docs ?? []) {
    await reindexDocumentChunks({
      orgId: session.org!.id,
      documentId: d.id,
      content: String(d.content ?? ""),
    });
  }
  revalidatePath("/dashboard/knowledge");
}
