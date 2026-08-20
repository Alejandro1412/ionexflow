import { createServiceRoleClient } from "@/lib/supabase/server";
import { chunkDocumentText } from "@/lib/knowledge/chunk";

/** Rebuild searchable chunks for a document (service role). */
export async function reindexDocumentChunks(options: {
  orgId: string;
  documentId: string;
  content: string;
}) {
  const admin = createServiceRoleClient();
  await admin
    .from("knowledge_chunks")
    .delete()
    .eq("document_id", options.documentId)
    .eq("org_id", options.orgId);

  const pieces = chunkDocumentText(options.content);
  if (!pieces.length) return;

  const rows = pieces.map((content, chunk_index) => ({
    org_id: options.orgId,
    document_id: options.documentId,
    chunk_index,
    content,
  }));

  const { error } = await admin.from("knowledge_chunks").insert(rows);
  if (error) {
    // Table may not exist yet pre-migration — ignore
    if (!/relation .* does not exist/i.test(error.message)) {
      console.warn("knowledge reindex:", error.message);
    }
  }
}

export async function extractTextFromUpload(file: File): Promise<{
  text: string;
  titleHint: string;
}> {
  const name = file.name || "document";
  const lower = name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".json") ||
    file.type.startsWith("text/")
  ) {
    return { text: buf.toString("utf8"), titleHint: name.replace(/\.[^.]+$/, "") };
  }

  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buf });
      try {
        const parsed = await parser.getText();
        return {
          text: parsed.text || "",
          titleHint: name.replace(/\.pdf$/i, ""),
        };
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    } catch {
      throw new Error(
        "No se pudo leer el PDF. Pega el texto o convierte a .txt/.md."
      );
    }
  }

  throw new Error("Formato no soportado. Usa .txt, .md, .csv o .pdf");
}
