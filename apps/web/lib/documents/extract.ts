import { generateAgentOutput } from "@/lib/ai/provider";
import { AGENT_MODE_META } from "@/lib/ai/modes";

/**
 * Extract structured fields from document/trigger text via LLM (extract mode).
 */
export async function extractDocumentFields(options: {
  orgId: string;
  documentText: string;
  fieldsHint?: string;
  label?: string;
}): Promise<{
  output: string;
  model?: string;
  provider?: string;
  latencyMs?: number;
  notice?: string;
}> {
  const text = options.documentText.trim();
  if (!text) {
    throw new Error("No document text to extract");
  }

  const fields =
    options.fieldsHint?.trim() ||
    "amount, currency, vendor/provider, date, invoice_number, id_numbers, parties, due_date, anomalies";

  const extract = AGENT_MODE_META.extract;
  const result = await generateAgentOutput({
    agentLabel: options.label ?? "Document extract",
    orgId: options.orgId,
    source: "document_extract",
    temperature: 0.1,
    model: "gpt-4o-mini",
    systemPrompt:
      extract.system +
      "\nReturn Markdown with a clear field list and a short JSON block of extracted values. Flag uncertain fields.",
    prompt: [
      `Extract these fields when present: ${fields}`,
      "",
      "Document / input:",
      text.slice(0, 24_000),
    ].join("\n"),
    triggerPayload: { input: text },
    context: {},
  });

  return {
    output: result.text,
    model: result.model,
    provider: result.provider,
    latencyMs: result.latencyMs,
    notice: result.notice,
  };
}
