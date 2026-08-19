import type { FlowEdge } from "@/lib/workflow/types";

/** Pick the next node; optional route matches edge label or sourceHandle. */
export function nextNodeId(
  nodeId: string,
  edges: FlowEdge[],
  route?: string
): string | null {
  if (route) {
    const match = edges.find(
      (e) =>
        e.source === nodeId &&
        (e.label === route || e.sourceHandle === route)
    );
    if (match) return match.target;
  }
  return edges.find((e) => e.source === nodeId)?.target ?? null;
}

export function allOutgoing(nodeId: string, edges: FlowEdge[]): FlowEdge[] {
  return edges.filter((e) => e.source === nodeId);
}
