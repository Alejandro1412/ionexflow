export type AgentMode =
  | "general"
  | "research"
  | "draft"
  | "rewrite"
  | "extract"
  | "support"
  | "sales"
  | "ops";

export const AGENT_MODE_META: Record<
  AgentMode,
  { label: string; description: string; system: string; defaultPrompt: string }
> = {
  general: {
    label: "General",
    description: "Agente flexible para cualquier tarea",
    system:
      "You are an elite IonexFlow autonomous agent. Deliver executive Markdown with clear recommendations. Match the user's language.",
    defaultPrompt: "Completa la tarea descrita en el trigger con calidad ejecutiva.",
  },
  research: {
    label: "Research",
    description: "Investiga, resume riesgos y next actions",
    system:
      "You are a senior B2B research strategist. Produce a structured research brief: signals, audience, risks, and next actions. No invented metrics.",
    defaultPrompt:
      "Investiga el brief del trigger: audiencia, tono, claims sensibles y riesgos. Entrega un research brief accionable.",
  },
  draft: {
    label: "Draft / Copy",
    description: "Genera variantes de copy o documentos",
    system:
      "You are a brand copy chief. Produce polished Markdown variants with a clear recommendation. Flag legal-sensitive lines.",
    defaultPrompt:
      "Genera 3 variantes de copy (A/B/C), una recomendación de cuál usar, y marca frases que requieren revisión.",
  },
  rewrite: {
    label: "Rewrite",
    description: "Mejora el último output upstream",
    system:
      "You are an editor-in-chief. Rewrite the upstream agent output for clarity, punch, and brand safety. Preserve intent.",
    defaultPrompt:
      " Reescribe el output upstream: más claro, más corto, mismo idioma. Mantén hechos; elimina fluff.",
  },
  extract: {
    label: "Extract",
    description: "Extrae datos estructurados",
    system:
      "You extract structured data. Prefer Markdown tables or bullet key/value pairs. If unsure, mark fields as UNKNOWN.",
    defaultPrompt:
      "Extrae del trigger y del contexto: entidades, fechas, montos, owners, riesgos y próximos pasos en tabla Markdown.",
  },
  support: {
    label: "Support",
    description: "Respuestas de soporte / tickets",
    system:
      "You are an empathetic senior support agent. Draft a reply the human can send: acknowledgment, diagnosis, steps, escalation note.",
    defaultPrompt:
      "Redacta una respuesta de soporte lista para enviar basada en el ticket del trigger. Incluye pasos claros.",
  },
  sales: {
    label: "Sales",
    description: "Califica leads y propone follow-up",
    system:
      "You are an enterprise AE. Score the lead, list pains, propose next touch, and draft a short outreach note.",
    defaultPrompt:
      "Califica el lead del trigger (Hot/Warm/Cold), justifica, y redacta un follow-up de 80 palabras.",
  },
  ops: {
    label: "Ops / Process",
    description: "Convierte notas en procesos ejecutables",
    system:
      "You are an operations lead. Turn inputs into a runnable checklist: owners, SLA, risks, and Definition of Done.",
    defaultPrompt:
      "Convierte el trigger en un playbook operativo con checklist, owners sugeridos y Definition of Done.",
  },
};

export function systemForMode(mode: AgentMode | undefined, override?: string) {
  if (override?.trim()) return override.trim();
  return AGENT_MODE_META[mode ?? "general"].system;
}
