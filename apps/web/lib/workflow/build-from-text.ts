import { z } from "zod";
import { generateAgentOutput } from "@/lib/ai/provider";
import type { FlowEdge, FlowNode, WorkflowNodeType } from "@/lib/workflow/types";

const ALLOWED: WorkflowNodeType[] = [
  "start",
  "agent",
  "classifier",
  "condition",
  "approval",
  "delay",
  "http",
  "slack",
  "webhook",
  "email_send",
  "email_forward",
  "whatsapp_send",
  "browser_agent",
  "document_extract",
  "end",
];

const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z
    .object({
      label: z.string(),
      type: z.string(),
    })
    .passthrough(),
});

const edgeSchema = z.object({
  id: z.string().min(1),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  label: z.string().optional(),
});

const graphSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  nodes: z.array(nodeSchema).min(2).max(40),
  edges: z.array(edgeSchema).max(80),
});

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() || text.trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function buildWorkflowFromDescription(options: {
  description: string;
  orgId: string;
}): Promise<{ name: string; nodes: FlowNode[]; edges: FlowEdge[]; notice?: string }> {
  const description = options.description.trim();
  if (description.length < 12) {
    throw new Error("Describe el proceso con más detalle (mín. ~12 caracteres).");
  }

  const result = await generateAgentOutput({
    agentLabel: "Workflow architect",
    orgId: options.orgId,
    source: "workflow_builder",
    temperature: 0.2,
    model: "gpt-4o-mini",
    systemPrompt: `Eres un arquitecto de workflows para IonexFlow.
Responde SOLO con JSON válido (sin markdown) con esta forma:
{
  "name": "nombre corto del proceso",
  "nodes": [{ "id": "...", "type": "workflow", "position": {"x":0,"y":0}, "data": { "label": "...", "type": "<nodeType>", ... } }],
  "edges": [{ "id": "...", "source": "...", "target": "...", "sourceHandle": null, "label": optional }]
}

Tipos de nodo permitidos: ${ALLOWED.join(", ")}.
Reglas:
- Debe haber exactamente un nodo start y al menos un end.
- Usa agent para IA, approval para revisión humana, condition para reglas sin IA (handles true/false), classifier para rutas LLM.
- Correo entrante: el trigger ya trae from/subject/body. Responder al cliente = email_send (toTemplate "{{from}}"). Avisar a un jefe/interno = email_forward o slack (toTemplate con placeholder tipo "{{to}}" o un email ejemplo jefe@empresa.com).
- WhatsApp: whatsapp_send. Slack: slack con url placeholder.
- Condition: data.conditionLeft, conditionOp, conditionRight y edges con sourceHandle "true"/"false".
- Agent: incluye prompt y systemPrompt en español orientados al caso (empatía, tono, Knowledge).
- Si el usuario pide responder a cliente: approval ANTES del email_send/whatsapp_send.
- Si pide avisar a jefe + responder cliente: puedes fan-out (dos edges desde approval) o secuencia agent → approval → email_send + email_forward/slack.
- Approval: slaMinutes opcional (ej. 240).
- Posiciones: layout horizontal (x aumenta ~220 por columna).
- No inventes secretos reales; URLs de ejemplo ok.
- Preferir HITL (approval) antes de enviar mensajes a clientes.
- Nombre del proceso corto y en español.`,
    prompt: `Diseña el workflow para este proceso de negocio:\n\n${description}`,
    triggerPayload: { input: description },
    context: {},
  });

  const parsed = graphSchema.parse(extractJson(result.text));
  const nodes: FlowNode[] = parsed.nodes.map((n, i) => {
    const t = n.data.type as WorkflowNodeType;
    if (!ALLOWED.includes(t)) {
      throw new Error(`Unsupported node type: ${t}`);
    }
    return {
      id: n.id,
      type: "workflow",
      position: n.position ?? { x: 40 + i * 220, y: 160 },
      data: {
        ...(n.data as FlowNode["data"]),
        type: t,
        label: n.data.label || t,
      },
    };
  });

  if (!nodes.some((n) => n.data.type === "start")) {
    throw new Error("Generated graph missing start node");
  }

  const edges: FlowEdge[] = parsed.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
    label: e.label,
  }));

  return {
    name: parsed.name?.trim() || "Proceso generado",
    nodes,
    edges,
    notice: result.notice,
  };
}
