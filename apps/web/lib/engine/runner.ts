import type {
  ExecutionLogEntry,
  FlowEdge,
  FlowNode,
  FlowNodeData,
} from "@/lib/workflow/types";

export type RunnerResult =
  | { kind: "completed"; logs: ExecutionLogEntry[] }
  | { kind: "failed"; logs: ExecutionLogEntry[]; error: string }
  | {
      kind: "paused";
      logs: ExecutionLogEntry[];
      approvalNodeId: string;
      approvalPayload: Record<string, unknown>;
    };

function log(
  nodeId: string,
  message: string,
  level: ExecutionLogEntry["level"] = "info"
): ExecutionLogEntry {
  return { at: new Date().toISOString(), nodeId, level, message };
}

function nextNodeId(nodeId: string, edges: FlowEdge[]) {
  return edges.find((e) => e.source === nodeId)?.target ?? null;
}

function getData(node: FlowNode): FlowNodeData {
  return node.data;
}

/**
 * Walks the React Flow graph from `fromNodeId` (or the start node).
 * Agent steps are simulated; approval nodes pause for human review.
 */
export function runWorkflowGraph(options: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  fromNodeId?: string | null;
  skipCurrent?: boolean;
  triggerPayload?: Record<string, unknown>;
  existingLogs?: ExecutionLogEntry[];
}): RunnerResult {
  const { nodes, edges, triggerPayload = {}, existingLogs = [] } = options;
  const logs = [...existingLogs];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  let currentId =
    options.fromNodeId ??
    nodes.find((n) => getData(n).type === "start")?.id ??
    null;

  if (!currentId) {
    return { kind: "failed", logs, error: "Workflow has no start node" };
  }

  if (options.skipCurrent) {
    currentId = nextNodeId(currentId, edges);
  }

  let guard = 0;
  while (currentId && guard < 100) {
    guard += 1;
    const node = byId.get(currentId);
    if (!node) {
      return { kind: "failed", logs, error: `Missing node ${currentId}` };
    }

    const data = getData(node);

    switch (data.type) {
      case "start": {
        logs.push(
          log(
            node.id,
            `Workflow started. Trigger: ${JSON.stringify(triggerPayload)}`
          )
        );
        currentId = nextNodeId(node.id, edges);
        break;
      }
      case "agent": {
        const prompt = data.prompt ?? "No prompt configured";
        logs.push(log(node.id, `Agent "${data.label}" running…`));
        logs.push(
          log(
            node.id,
            `Agent output: Analyzed payload with prompt "${prompt}". Suggested action: proceed.`,
            "success"
          )
        );
        currentId = nextNodeId(node.id, edges);
        break;
      }
      case "approval": {
        logs.push(
          log(node.id, `Paused for approval: ${data.message ?? data.label}`, "warn")
        );
        return {
          kind: "paused",
          logs,
          approvalNodeId: node.id,
          approvalPayload: {
            label: data.label,
            message: data.message ?? "Please approve to continue.",
            lastLogs: logs.slice(-3),
            triggerPayload,
          },
        };
      }
      case "end": {
        logs.push(log(node.id, "Workflow completed.", "success"));
        return { kind: "completed", logs };
      }
      default:
        return {
          kind: "failed",
          logs,
          error: `Unknown node type on ${node.id}`,
        };
    }
  }

  return { kind: "failed", logs, error: "Workflow ended without an End node" };
}
