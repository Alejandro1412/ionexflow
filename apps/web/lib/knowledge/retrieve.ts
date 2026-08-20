import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { scoreChunk, tokenize } from "@/lib/knowledge/chunk";

export type KnowledgeChunk = {
  id: string;
  title: string;
  content: string;
  docKind?: string;
  score?: number;
};

/**
 * Ranked retrieval over knowledge_chunks (fallback: whole documents).
 * Multi-token scoring so agents get relevant company policy/catalog — not random recent docs.
 */
export async function retrieveOrgKnowledge(options: {
  orgId: string;
  query: string;
  limit?: number;
  preferKinds?: string[];
}): Promise<KnowledgeChunk[]> {
  const limit = Math.min(8, Math.max(1, options.limit ?? 5));
  const admin = createServiceRoleClient();
  const query = options.query.trim().slice(0, 2000);
  const tokens = tokenize(query).slice(0, 12);

  // 1) Prefer chunks table
  const { data: chunks, error: chunkError } = await admin
    .from("knowledge_chunks")
    .select("id, content, document_id, document_knowledge(title, doc_kind)")
    .eq("org_id", options.orgId)
    .limit(200);

  if (!chunkError && chunks && chunks.length > 0) {
    const scored = chunks
      .map((row) => {
        const doc = row.document_knowledge as
          | { title?: string; doc_kind?: string }
          | { title?: string; doc_kind?: string }[]
          | null;
        const meta = Array.isArray(doc) ? doc[0] : doc;
        const content = String(row.content ?? "");
        let score = scoreChunk(query, content);
        const kind = meta?.doc_kind ?? "general";
        if (options.preferKinds?.includes(kind)) score += 0.15;
        return {
          id: String(row.id),
          title: meta?.title ?? "Document",
          content: content.slice(0, 2200),
          docKind: kind,
          score,
        };
      })
      .filter((c) => (tokens.length ? c.score > 0 : true))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    if (scored.length) return scored.slice(0, limit);

    // No token hits — return top recent chunks by length diversity
    return chunks.slice(0, limit).map((row) => {
      const doc = row.document_knowledge as
        | { title?: string; doc_kind?: string }
        | null;
      const meta = Array.isArray(doc) ? doc[0] : doc;
      return {
        id: String(row.id),
        title: meta?.title ?? "Document",
        content: String(row.content).slice(0, 2200),
        docKind: meta?.doc_kind,
        score: 0,
      };
    });
  }

  // 2) Fallback: whole documents (pre-migration / empty chunks)
  const { data: docs } = await admin
    .from("document_knowledge")
    .select("id, title, content, doc_kind")
    .eq("org_id", options.orgId)
    .order("updated_at", { ascending: false })
    .limit(40);

  const scoredDocs = (docs ?? [])
    .map((d) => {
      const content = String(d.content ?? "");
      let score = scoreChunk(query, `${d.title}\n${content}`);
      if (options.preferKinds?.includes(String(d.doc_kind ?? ""))) {
        score += 0.15;
      }
      return {
        id: d.id as string,
        title: d.title as string,
        content: content.slice(0, 2500),
        docKind: (d.doc_kind as string) ?? "general",
        score,
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (scoredDocs.some((d) => (d.score ?? 0) > 0)) {
    return scoredDocs.filter((d) => (d.score ?? 0) > 0).slice(0, limit);
  }
  return scoredDocs.slice(0, limit);
}

export function formatKnowledgeForPrompt(chunks: KnowledgeChunk[]) {
  if (!chunks.length) return "";
  return chunks
    .map((c, i) => {
      const kind = c.docKind ? ` (${c.docKind})` : "";
      return `[Doc ${i + 1}: ${c.title}${kind}]\n${c.content.slice(0, 1800)}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Pull recent email/WhatsApp history with this customer (by from address/phone).
 */
export async function retrieveCustomerHistory(options: {
  orgId: string;
  from?: string | null;
  limit?: number;
}): Promise<string> {
  const from = (options.from ?? "").trim();
  if (from.length < 3) return "";
  const admin = createServiceRoleClient();
  const limit = Math.min(10, options.limit ?? 6);
  const parts: string[] = [];

  const { data: mails } = await admin
    .from("email_messages")
    .select("direction, from_address, subject, body_text, created_at")
    .eq("org_id", options.orgId)
    .ilike("from_address", `%${from.replace(/[%_]/g, "")}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  for (const m of mails ?? []) {
    parts.push(
      `[email ${m.direction} ${m.created_at}] ${m.subject ?? ""}\n${String(m.body_text ?? "").slice(0, 500)}`
    );
  }

  const digits = from.replace(/\D/g, "");
  if (digits.length >= 8) {
    const { data: wa } = await admin
      .from("whatsapp_messages")
      .select("direction, from_phone, body_text, created_at")
      .eq("org_id", options.orgId)
      .or(`from_phone.ilike.%${digits.slice(-10)}%,to_phone.ilike.%${digits.slice(-10)}%`)
      .order("created_at", { ascending: false })
      .limit(limit);

    for (const w of wa ?? []) {
      parts.push(
        `[whatsapp ${w.direction} ${w.created_at}] ${String(w.body_text ?? "").slice(0, 500)}`
      );
    }
  }

  if (!parts.length) return "";
  return [
    "Historial reciente con este cliente (usa solo hechos; no inventes):",
    ...parts,
  ].join("\n\n");
}

export async function listOrgKnowledgeForSession(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("document_knowledge")
    .select("id, title, tags, doc_kind, created_at, updated_at")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
