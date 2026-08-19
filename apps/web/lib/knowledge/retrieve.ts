import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export type KnowledgeChunk = {
  id: string;
  title: string;
  content: string;
};

/**
 * Lightweight retrieval without embeddings: ILIKE + recent docs fallback.
 */
export async function retrieveOrgKnowledge(options: {
  orgId: string;
  query: string;
  limit?: number;
}): Promise<KnowledgeChunk[]> {
  const limit = Math.min(8, Math.max(1, options.limit ?? 5));
  const q = options.query.trim().slice(0, 200).replace(/[%_,]/g, " ");
  const admin = createServiceRoleClient();

  if (q.length >= 2) {
    const { data: like } = await admin
      .from("document_knowledge")
      .select("id, title, content")
      .eq("org_id", options.orgId)
      .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
      .limit(limit);

    if (like?.length) {
      return like.map((d) => ({
        id: d.id,
        title: d.title,
        content: String(d.content).slice(0, 2500),
      }));
    }
  }

  const { data: recent } = await admin
    .from("document_knowledge")
    .select("id, title, content")
    .eq("org_id", options.orgId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  return (recent ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    content: String(d.content).slice(0, 2500),
  }));
}

export function formatKnowledgeForPrompt(chunks: KnowledgeChunk[]) {
  if (!chunks.length) return "";
  return chunks
    .map(
      (c, i) => `[Doc ${i + 1}: ${c.title}]\n${c.content.slice(0, 1800)}`
    )
    .join("\n\n---\n\n");
}

export async function listOrgKnowledgeForSession(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("document_knowledge")
    .select("id, title, tags, created_at, updated_at")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
