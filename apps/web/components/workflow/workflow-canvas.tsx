"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  Handle,
  Position,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveWorkflow } from "@/actions/workflows";
import { startExecution } from "@/actions/executions";
import type { FlowEdge, FlowNode, FlowNodeData, WorkflowNodeType } from "@/lib/workflow/types";

const TYPE_COLORS: Record<WorkflowNodeType, string> = {
  start: "border-emerald-400/60 bg-emerald-500/10",
  agent: "border-signal/50 bg-signal/10",
  approval: "border-amber-400/60 bg-amber-500/10",
  end: "border-arc/50 bg-arc/10",
};

function WorkflowNodeView({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  return (
    <div
      className={`min-w-[160px] rounded-lg border px-3 py-2 shadow-lg backdrop-blur ${TYPE_COLORS[data.type]} ${
        selected ? "ring-2 ring-signal" : ""
      }`}
    >
      {data.type !== "start" ? <Handle type="target" position={Position.Left} /> : null}
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{data.type}</p>
      <p className="font-display text-sm font-semibold">{data.label}</p>
      {data.type !== "end" ? <Handle type="source" position={Position.Right} /> : null}
    </div>
  );
}

const nodeTypes: NodeTypes = { workflow: WorkflowNodeView };

export function WorkflowCanvas({
  workflowId,
  initialName,
  initialNodes,
  initialEdges,
  initialActive,
}: {
  workflowId: string;
  initialName: string;
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
  initialActive: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [isActive, setIsActive] = useState(initialActive);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(
    initialNodes as Node<FlowNodeData>[]
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges as Edge[]);
  const [status, setStatus] = useState<string | null>(null);
  const [trigger, setTrigger] = useState("Manual run from canvas");
  const [saving, setSaving] = useState(false);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const selected = useMemo(() => nodes.find((n) => n.selected), [nodes]);

  function updateSelectedData(patch: Partial<FlowNodeData>) {
    if (!selected) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selected.id ? { ...n, data: { ...n.data, ...patch } } : n
      )
    );
  }

  function addNode(type: WorkflowNodeType) {
    const id = `${type}-${crypto.randomUUID().slice(0, 8)}`;
    const label =
      type === "agent"
        ? "New agent"
        : type === "approval"
          ? "Approval gate"
          : type === "start"
            ? "Start"
            : "End";
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "workflow",
        position: { x: 200 + nds.length * 40, y: 120 + (nds.length % 3) * 60 },
        data: {
          label,
          type,
          prompt: type === "agent" ? "Describe the agent task" : undefined,
          message: type === "approval" ? "Approve to continue" : undefined,
        },
      },
    ]);
  }

  async function onSave() {
    setSaving(true);
    setStatus(null);
    const result = await saveWorkflow(workflowId, {
      name,
      nodes: nodes as FlowNode[],
      edges: edges as FlowEdge[],
      is_active: isActive,
    });
    setSaving(false);
    setStatus(result?.error ?? "Saved");
  }

  async function onRun() {
    setStatus(null);
    await onSave();
    await startExecution(workflowId, trigger);
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <Label htmlFor="wf-name">Workflow name</Label>
          <Input id="wf-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
        <Button type="button" variant="outline" onClick={() => addNode("agent")}>
          + Agent
        </Button>
        <Button type="button" variant="outline" onClick={() => addNode("approval")}>
          + Approval
        </Button>
        <Button type="button" variant="outline" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" onClick={onRun}>
          Run
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_280px]">
        <div className="glass-panel min-h-[420px] overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            colorMode="dark"
          >
            <Background gap={18} color="#1a2438" />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        <aside className="glass-panel flex flex-col gap-3 p-4">
          <h3 className="font-display text-sm font-semibold">Inspector</h3>
          {selected ? (
            <>
              <div className="flex flex-col gap-1">
                <Label>Label</Label>
                <Input
                  value={(selected.data as FlowNodeData).label}
                  onChange={(e) => updateSelectedData({ label: e.target.value })}
                />
              </div>
              {(selected.data as FlowNodeData).type === "agent" ? (
                <div className="flex flex-col gap-1">
                  <Label>Prompt</Label>
                  <textarea
                    className="min-h-[100px] rounded-md border border-white/10 bg-black/30 p-2 text-sm"
                    value={(selected.data as FlowNodeData).prompt ?? ""}
                    onChange={(e) => updateSelectedData({ prompt: e.target.value })}
                  />
                </div>
              ) : null}
              {(selected.data as FlowNodeData).type === "approval" ? (
                <div className="flex flex-col gap-1">
                  <Label>Message</Label>
                  <textarea
                    className="min-h-[80px] rounded-md border border-white/10 bg-black/30 p-2 text-sm"
                    value={(selected.data as FlowNodeData).message ?? ""}
                    onChange={(e) => updateSelectedData({ message: e.target.value })}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a node to edit.</p>
          )}

          <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-3">
            <Label>Run trigger payload</Label>
            <Input value={trigger} onChange={(e) => setTrigger(e.target.value)} />
          </div>
          {status ? <p className="text-xs text-signal">{status}</p> : null}
        </aside>
      </div>
    </div>
  );
}
