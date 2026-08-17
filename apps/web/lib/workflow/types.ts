export type WorkflowNodeType = "start" | "agent" | "approval" | "end";

export type FlowNodeData = {
  label: string;
  type: WorkflowNodeType;
  prompt?: string;
  message?: string;
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
};

export type ExecutionLogEntry = {
  at: string;
  nodeId: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
};

export function defaultWorkflowGraph(): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = [
    {
      id: "start-1",
      type: "workflow",
      position: { x: 80, y: 160 },
      data: { label: "Start", type: "start" },
    },
    {
      id: "agent-1",
      type: "workflow",
      position: { x: 320, y: 160 },
      data: {
        label: "Research agent",
        type: "agent",
        prompt: "Summarize the trigger payload and propose next actions.",
      },
    },
    {
      id: "approval-1",
      type: "workflow",
      position: { x: 560, y: 160 },
      data: {
        label: "Human approval",
        type: "approval",
        message: "Review the agent output before continuing.",
      },
    },
    {
      id: "end-1",
      type: "workflow",
      position: { x: 800, y: 160 },
      data: { label: "End", type: "end" },
    },
  ];

  const edges: FlowEdge[] = [
    { id: "e1", source: "start-1", target: "agent-1" },
    { id: "e2", source: "agent-1", target: "approval-1" },
    { id: "e3", source: "approval-1", target: "end-1" },
  ];

  return { nodes, edges };
}
