import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

/**
 * When humans reject or heavily edit AI output, persist a learning insight
 * and a Knowledge doc so future agents can avoid the same mistakes.
 */
export async function recordApprovalLearning(
  supabase: Client,
  options: {
    orgId: string;
    workflowId: string | null;
    approvalId: string;
    decision: "approved" | "rejected";
    agentOutput: string | null;
    editedOutput: string | null;
    agentLabel?: string | null;
  }
) {
  const {
    orgId,
    workflowId,
    approvalId,
    decision,
    agentOutput,
    editedOutput,
    agentLabel,
  } = options;

  const wasEdited =
    Boolean(editedOutput?.trim()) &&
    editedOutput!.trim() !== (agentOutput ?? "").trim();
  if (decision !== "rejected" && !wasEdited) return;

  const title =
    decision === "rejected"
      ? `Learning: rejected${agentLabel ? ` — ${agentLabel}` : ""}`
      : `Learning: human edit${agentLabel ? ` — ${agentLabel}` : ""}`;

  const suggestion =
    decision === "rejected"
      ? [
          "Un humano rechazó esta propuesta de la IA.",
          agentLabel ? `Nodo: ${agentLabel}` : null,
          "",
          "Salida rechazada:",
          (agentOutput || "(vacío)").slice(0, 4000),
          "",
          "Sugerencia: ajusta el prompt del agente para ser más conservador,",
          "citar Knowledge de la empresa, y evitar claims no verificados.",
        ]
          .filter(Boolean)
          .join("\n")
      : [
          "Un humano editó la salida de la IA antes de aprobar.",
          agentLabel ? `Nodo: ${agentLabel}` : null,
          "",
          "Original IA:",
          (agentOutput || "(vacío)").slice(0, 2500),
          "",
          "Versión humana:",
          (editedOutput || "").slice(0, 2500),
          "",
          "Sugerencia: incorpora el tono, hechos y estructura de la versión humana",
          "en el system prompt / Knowledge del proceso.",
        ]
          .filter(Boolean)
          .join("\n");

  await supabase.from("process_insights").insert({
    org_id: orgId,
    workflow_id: workflowId,
    approval_id: approvalId,
    kind: decision === "rejected" ? "approval_rejected" : "approval_edited",
    title,
    suggestion,
    status: "pending",
    meta: {
      decision,
      agentLabel: agentLabel ?? null,
      hasEdit: wasEdited,
    },
  });

  await supabase.from("document_knowledge").insert({
    org_id: orgId,
    title,
    content: suggestion,
    tags: "learning,auto,approvals",
    meta: {
      source: "approval_learning",
      approvalId,
      workflowId,
      decision,
    },
  });
}
