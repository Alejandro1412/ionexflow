import type { AgentMode } from "@/lib/ai/modes";
import { AGENT_MODE_META } from "@/lib/ai/modes";

export type WorkflowNodeType =
  | "start"
  | "agent"
  | "classifier"
  | "condition"
  | "approval"
  | "delay"
  | "http"
  | "slack"
  | "webhook"
  | "email_send"
  | "email_forward"
  | "whatsapp_send"
  | "end";

export type FlowNodeData = {
  label: string;
  type: WorkflowNodeType;
  prompt?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  message?: string;
  /** Agent playbook mode */
  agentMode?: AgentMode;
  /** Comma-separated route keys for classifier nodes */
  routes?: string;
  /** Delay node — minutes to wait before continuing */
  waitMinutes?: number;
  /** Retries for agent/http/email (default 2) */
  maxRetries?: number;
  /** HTTP / Slack / Webhook */
  url?: string;
  method?: string;
  headersJson?: string;
  bodyTemplate?: string;
  /** Fail the run when status >= 400 (default true) */
  failOnError?: boolean;
  /** Email send / forward */
  toTemplate?: string;
  subjectTemplate?: string;
  bodyEmailTemplate?: string;
  fromAddress?: string;
  /** Deterministic condition (no LLM) */
  conditionLeft?: string;
  conditionOp?: string;
  conditionRight?: string;
  /** Approval SLA minutes (0 = none); Slack webhook for Approve/Reject buttons */
  slaMinutes?: number;
  approvalSlackWebhook?: string;
  /** Inject org knowledge base into agent context */
  useOrgKnowledge?: boolean;
  /** WhatsApp send */
  waToTemplate?: string;
  waBodyTemplate?: string;
};

export type FlowNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: FlowNodeData;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
};

export type ExecutionLogEntry = {
  at: string;
  nodeId: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  kind?: "agent_output" | "system" | "route" | "http_output" | "email_output";
  output?: string;
  model?: string;
  provider?: string;
  latencyMs?: number;
  route?: string;
  statusCode?: number;
};

export function parseRoutes(routes?: string): string[] {
  return (routes ?? "needs_human,auto_ok")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
}

export function defaultWorkflowGraph(): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const research = AGENT_MODE_META.research;
  const draft = AGENT_MODE_META.draft;
  const nodes: FlowNode[] = [
    {
      id: "start-1",
      type: "workflow",
      position: { x: 40, y: 180 },
      data: { label: "Start", type: "start" },
    },
    {
      id: "agent-research",
      type: "workflow",
      position: { x: 260, y: 120 },
      data: {
        label: "Research agent",
        type: "agent",
        agentMode: "research",
        model: "gpt-4o-mini",
        prompt: research.defaultPrompt,
        systemPrompt: research.system,
      },
    },
    {
      id: "agent-draft",
      type: "workflow",
      position: { x: 520, y: 120 },
      data: {
        label: "Draft copy agent",
        type: "agent",
        agentMode: "draft",
        model: "gpt-4o-mini",
        prompt: draft.defaultPrompt,
        systemPrompt: draft.system,
      },
    },
    {
      id: "approval-1",
      type: "workflow",
      position: { x: 780, y: 180 },
      data: {
        label: "Director approval",
        type: "approval",
        message:
          "Revisa el copy generado por el agente antes de publicar. Aprueba solo si tono y claims están limpios.",
      },
    },
    {
      id: "end-1",
      type: "workflow",
      position: { x: 1040, y: 180 },
      data: { label: "End", type: "end" },
    },
  ];

  const edges: FlowEdge[] = [
    { id: "e1", source: "start-1", target: "agent-research" },
    { id: "e2", source: "agent-research", target: "agent-draft" },
    { id: "e3", source: "agent-draft", target: "approval-1" },
    { id: "e4", source: "approval-1", target: "end-1" },
  ];

  return { nodes, edges };
}
