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
  MarkerType,
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
import { AGENT_MODE_META, type AgentMode } from "@/lib/ai/modes";
import {
  parseRoutes,
  type FlowEdge,
  type FlowNode,
  type FlowNodeData,
  type WorkflowNodeType,
} from "@/lib/workflow/types";

const TYPE_COLORS: Record<WorkflowNodeType, string> = {
  start: "border-emerald-400/60 bg-emerald-500/10",
  agent: "border-signal/50 bg-signal/10",
  classifier: "border-violet-400/60 bg-violet-500/15",
  approval: "border-amber-400/60 bg-amber-500/10",
  delay: "border-yellow-400/50 bg-yellow-500/10",
  http: "border-sky-400/60 bg-sky-500/10",
  slack: "border-fuchsia-400/50 bg-fuchsia-500/10",
  webhook: "border-cyan-400/50 bg-cyan-500/10",
  email_send: "border-teal-400/60 bg-teal-500/10",
  email_forward: "border-orange-400/50 bg-orange-500/10",
  end: "border-arc/50 bg-arc/10",
};

function WorkflowNodeView({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  const routes =
    data.type === "classifier" ? parseRoutes(data.routes) : [];

  return (
    <div
      className={`min-w-[170px] rounded-lg border px-3 py-2 shadow-lg backdrop-blur ${TYPE_COLORS[data.type]} ${
        selected ? "ring-2 ring-signal" : ""
      }`}
    >
      {data.type !== "start" ? (
        <Handle type="target" position={Position.Left} />
      ) : null}
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {data.type}
      </p>
      <p className="font-display text-sm font-semibold">{data.label}</p>
      {data.type === "agent" ? (
        <p className="mt-1 truncate text-[10px] text-signal/80">
          {[data.agentMode, data.model].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {data.type === "classifier" ? (
        <p className="mt-1 text-[10px] text-violet-200/90">
          routes: {routes.join(" | ")}
        </p>
      ) : null}
      {data.type === "http" || data.type === "slack" || data.type === "webhook" ? (
        <p className="mt-1 truncate text-[10px] text-sky-200/90">
          {data.method ?? "POST"} · {data.url || "set URL"}
        </p>
      ) : null}
      {data.type === "delay" ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          wait {data.waitMinutes ?? 60}m
        </p>
      ) : null}
      {data.type === "email_send" || data.type === "email_forward" ? (
        <p className="mt-1 truncate text-[10px] text-teal-200/90">
          → {data.toTemplate || (data.type === "email_send" ? "{{from}}" : "{{to}}")}
        </p>
      ) : null}
      {data.type === "classifier" ? (
        routes.map((route, index) => (
          <Handle
            key={route}
            id={route}
            type="source"
            position={Position.Right}
            style={{ top: `${28 + index * 22}px` }}
          />
        ))
      ) : data.type !== "end" ? (
        <Handle type="source" position={Position.Right} />
      ) : null}
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
  initialScheduleEnabled = false,
  initialScheduleEveryMinutes = 60,
  aiStatus,
}: {
  workflowId: string;
  initialName: string;
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
  initialActive: boolean;
  initialScheduleEnabled?: boolean;
  initialScheduleEveryMinutes?: number | null;
  aiStatus?: { live: boolean; label: string; hint: string };
}) {
  const [name, setName] = useState(initialName);
  const [isActive, setIsActive] = useState(initialActive);
  const [scheduleEnabled, setScheduleEnabled] = useState(initialScheduleEnabled);
  const [scheduleEveryMinutes, setScheduleEveryMinutes] = useState(
    initialScheduleEveryMinutes ?? 60
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(
    initialNodes as Node<FlowNodeData>[]
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    (initialEdges as Edge[]).map((e) => ({
      ...e,
      label: e.label ?? (e as FlowEdge).sourceHandle ?? undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#3DFFF2" },
    }))
  );
  const [status, setStatus] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(
    "Cliente SaaS B2B — brief real para automatizar con IA"
  );
  const [saving, setSaving] = useState(false);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) =>
      addEdge(
        {
          ...connection,
          label: connection.sourceHandle ?? undefined,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#3DFFF2" },
        },
        eds
      )
    );
  }, [setEdges]);

  const selected = useMemo(() => nodes.find((n) => n.selected), [nodes]);
  const modes = Object.keys(AGENT_MODE_META) as AgentMode[];

  function updateSelectedData(patch: Partial<FlowNodeData>) {
    if (!selected) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selected.id ? { ...n, data: { ...n.data, ...patch } } : n
      )
    );
  }

  function applyMode(mode: AgentMode) {
    const meta = AGENT_MODE_META[mode];
    updateSelectedData({
      agentMode: mode,
      systemPrompt: meta.system,
      prompt: meta.defaultPrompt,
      label:
        selected?.data.label && !selected.data.label.startsWith("New")
          ? selected.data.label
          : `${meta.label} agent`,
    });
  }

  function addNode(type: WorkflowNodeType) {
    const id = `${type}-${crypto.randomUUID().slice(0, 8)}`;
    const label =
      type === "agent"
        ? "New agent"
        : type === "classifier"
          ? "AI classifier"
          : type === "approval"
            ? "Approval gate"
            : type === "http"
              ? "HTTP request"
              : type === "slack"
                ? "Slack notify"
                : type === "webhook"
                  ? "Outbound webhook"
                  : type === "email_send"
                    ? "Send email reply"
                    : type === "email_forward"
                      ? "Forward / redirect"
                      : type === "delay"
                        ? "Wait / delay"
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
          waitMinutes: type === "delay" ? 60 : undefined,
          maxRetries:
            type === "agent" ||
            type === "http" ||
            type === "slack" ||
            type === "webhook" ||
            type === "email_send" ||
            type === "email_forward"
              ? 2
              : undefined,
          agentMode: type === "agent" ? "general" : undefined,
          prompt:
            type === "agent"
              ? AGENT_MODE_META.general.defaultPrompt
              : type === "classifier"
                ? "Clasifica el input en una de las rutas definidas."
                : undefined,
          systemPrompt:
            type === "agent" ? AGENT_MODE_META.general.system : undefined,
          model: type === "agent" || type === "classifier" ? "gpt-4o-mini" : undefined,
          routes: type === "classifier" ? "needs_human,auto_ok" : undefined,
          message:
            type === "approval"
              ? "Approve to continue"
              : type === "slack"
                ? "*IonexFlow* — content ready\n\n{{agentOutput}}"
                : undefined,
          url:
            type === "slack"
              ? "https://hooks.slack.com/services/XXX/YYY/ZZZ"
              : type === "webhook" || type === "http"
                ? "https://example.com/hooks/ionexflow"
                : undefined,
          method: type === "http" ? "POST" : undefined,
          headersJson:
            type === "http"
              ? '{\n  "Content-Type": "application/json"\n}'
              : undefined,
          bodyTemplate:
            type === "http" || type === "webhook"
              ? '{\n  "content": "{{agentOutput}}",\n  "trigger": "{{trigger}}"\n}'
              : undefined,
          toTemplate:
            type === "email_send"
              ? "{{from}}"
              : type === "email_forward"
                ? "{{to}}"
                : undefined,
          subjectTemplate:
            type === "email_send"
              ? "Re: {{subject}}"
              : type === "email_forward"
                ? "Fwd: {{subject}}"
                : undefined,
          bodyEmailTemplate:
            type === "email_send"
              ? "{{agentOutput}}"
              : type === "email_forward"
                ? "Redirected by IonexFlow.\n\n{{body}}\n\n---\n{{agentOutput}}"
                : undefined,
          failOnError: true,
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
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: typeof e.label === "string" ? e.label : e.sourceHandle ?? undefined,
      })) as FlowEdge[],
      is_active: isActive,
      schedule_enabled: scheduleEnabled,
      schedule_every_minutes: scheduleEnabled
        ? Math.max(5, Number(scheduleEveryMinutes) || 60)
        : null,
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
      {aiStatus ? (
        <div
          className={`rounded-lg border px-4 py-2 text-sm ${
            aiStatus.live
              ? "border-signal/40 bg-signal/10 text-signal"
              : "border-amber-400/40 bg-amber-500/10 text-amber-100"
          }`}
        >
          <span className="font-semibold">{aiStatus.label}</span>
          <span className="text-muted-foreground"> — {aiStatus.hint}</span>
        </div>
      ) : null}
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
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={scheduleEnabled}
            onChange={(e) => setScheduleEnabled(e.target.checked)}
          />
          Auto schedule
        </label>
        {scheduleEnabled ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Label htmlFor="sched-min" className="whitespace-nowrap">
              Every (min)
            </Label>
            <Input
              id="sched-min"
              type="number"
              min={5}
              max={10080}
              className="w-24"
              value={scheduleEveryMinutes}
              onChange={(e) => setScheduleEveryMinutes(Number(e.target.value) || 60)}
            />
          </div>
        ) : null}
        <Button type="button" variant="outline" onClick={() => addNode("agent")}>
          + Agent
        </Button>
        <Button type="button" variant="outline" onClick={() => addNode("classifier")}>
          + Classifier
        </Button>
        <Button type="button" variant="outline" onClick={() => addNode("approval")}>
          + Approval
        </Button>
        <Button type="button" variant="outline" onClick={() => addNode("delay")}>
          + Delay
        </Button>
        <Button type="button" variant="outline" onClick={() => addNode("http")}>
          + HTTP
        </Button>
        <Button type="button" variant="outline" onClick={() => addNode("slack")}>
          + Slack
        </Button>
        <Button type="button" variant="outline" onClick={() => addNode("webhook")}>
          + Webhook
        </Button>
        <Button type="button" variant="outline" onClick={() => addNode("email_send")}>
          + Email
        </Button>
        <Button type="button" variant="outline" onClick={() => addNode("email_forward")}>
          + Forward
        </Button>
        <Button type="button" variant="outline" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" onClick={onRun}>
          Run
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_300px]">
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

        <aside className="glass-panel flex flex-col gap-3 overflow-y-auto p-4">
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
                <>
                  <div className="flex flex-col gap-1">
                    <Label>Playbook mode</Label>
                    <select
                      className="rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm"
                      value={(selected.data as FlowNodeData).agentMode ?? "general"}
                      onChange={(e) => applyMode(e.target.value as AgentMode)}
                    >
                      {modes.map((mode) => (
                        <option key={mode} value={mode}>
                          {AGENT_MODE_META[mode].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Model</Label>
                    <Input
                      placeholder="gpt-4o-mini"
                      value={(selected.data as FlowNodeData).model ?? ""}
                      onChange={(e) => updateSelectedData({ model: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Temperature (0–1)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={(selected.data as FlowNodeData).temperature ?? 0.7}
                      onChange={(e) =>
                        updateSelectedData({
                          temperature: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>System prompt</Label>
                    <textarea
                      className="min-h-[72px] rounded-md border border-white/10 bg-black/30 p-2 text-sm"
                      value={(selected.data as FlowNodeData).systemPrompt ?? ""}
                      onChange={(e) =>
                        updateSelectedData({ systemPrompt: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Task prompt</Label>
                    <textarea
                      className="min-h-[100px] rounded-md border border-white/10 bg-black/30 p-2 text-sm"
                      value={(selected.data as FlowNodeData).prompt ?? ""}
                      onChange={(e) => updateSelectedData({ prompt: e.target.value })}
                    />
                  </div>
                </>
              ) : null}
              {(selected.data as FlowNodeData).type === "classifier" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <Label>Routes (comma-separated)</Label>
                    <Input
                      value={(selected.data as FlowNodeData).routes ?? ""}
                      onChange={(e) => updateSelectedData({ routes: e.target.value })}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Conecta cada handle de la derecha a un destino distinto.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Model</Label>
                    <Input
                      value={(selected.data as FlowNodeData).model ?? ""}
                      onChange={(e) => updateSelectedData({ model: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Classification rules</Label>
                    <textarea
                      className="min-h-[100px] rounded-md border border-white/10 bg-black/30 p-2 text-sm"
                      value={(selected.data as FlowNodeData).prompt ?? ""}
                      onChange={(e) => updateSelectedData({ prompt: e.target.value })}
                    />
                  </div>
                </>
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
              {(selected.data as FlowNodeData).type === "delay" ? (
                <div className="flex flex-col gap-1">
                  <Label>Wait minutes</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10080}
                    value={(selected.data as FlowNodeData).waitMinutes ?? 60}
                    onChange={(e) =>
                      updateSelectedData({
                        waitMinutes: Number(e.target.value) || 60,
                      })
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Pauses the run; cron resumes after this wait (max 7 days).
                  </p>
                </div>
              ) : null}
              {(selected.data as FlowNodeData).type === "http" ||
              (selected.data as FlowNodeData).type === "slack" ||
              (selected.data as FlowNodeData).type === "webhook" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <Label>
                      {(selected.data as FlowNodeData).type === "slack"
                        ? "Slack webhook URL"
                        : "URL"}
                    </Label>
                    <Input
                      value={(selected.data as FlowNodeData).url ?? ""}
                      onChange={(e) => updateSelectedData({ url: e.target.value })}
                      placeholder="https://"
                    />
                  </div>
                  {(selected.data as FlowNodeData).type === "http" ? (
                    <>
                      <div className="flex flex-col gap-1">
                        <Label>Method</Label>
                        <select
                          className="rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm"
                          value={(selected.data as FlowNodeData).method ?? "POST"}
                          onChange={(e) =>
                            updateSelectedData({ method: e.target.value })
                          }
                        >
                          {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label>Headers (JSON)</Label>
                        <textarea
                          className="min-h-[72px] rounded-md border border-white/10 bg-black/30 p-2 font-mono text-xs"
                          value={(selected.data as FlowNodeData).headersJson ?? ""}
                          onChange={(e) =>
                            updateSelectedData({ headersJson: e.target.value })
                          }
                        />
                      </div>
                    </>
                  ) : null}
                  {(selected.data as FlowNodeData).type === "slack" ? (
                    <div className="flex flex-col gap-1">
                      <Label>Message</Label>
                      <textarea
                        className="min-h-[100px] rounded-md border border-white/10 bg-black/30 p-2 text-sm"
                        value={(selected.data as FlowNodeData).message ?? ""}
                        onChange={(e) =>
                          updateSelectedData({ message: e.target.value })
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <Label>Body template</Label>
                      <textarea
                        className="min-h-[120px] rounded-md border border-white/10 bg-black/30 p-2 font-mono text-xs"
                        value={(selected.data as FlowNodeData).bodyTemplate ?? ""}
                        onChange={(e) =>
                          updateSelectedData({ bodyTemplate: e.target.value })
                        }
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={(selected.data as FlowNodeData).failOnError !== false}
                      onChange={(e) =>
                        updateSelectedData({ failOnError: e.target.checked })
                      }
                    />
                    Fail run on HTTP error (≥400)
                  </label>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Templates: <code>{"{{agentOutput}}"}</code>,{" "}
                    <code>{"{{trigger}}"}</code>,{" "}
                    <code>{"{{context.NodeLabel}}"}</code>
                  </p>
                </>
              ) : null}
              {(selected.data as FlowNodeData).type === "email_send" ||
              (selected.data as FlowNodeData).type === "email_forward" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <Label>To (template)</Label>
                    <Input
                      value={(selected.data as FlowNodeData).toTemplate ?? ""}
                      onChange={(e) =>
                        updateSelectedData({ toTemplate: e.target.value })
                      }
                      placeholder="{{from}} or legal@company.com"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Subject</Label>
                    <Input
                      value={(selected.data as FlowNodeData).subjectTemplate ?? ""}
                      onChange={(e) =>
                        updateSelectedData({ subjectTemplate: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Body</Label>
                    <textarea
                      className="min-h-[100px] rounded-md border border-white/10 bg-black/30 p-2 text-sm"
                      value={
                        (selected.data as FlowNodeData).bodyEmailTemplate ?? ""
                      }
                      onChange={(e) =>
                        updateSelectedData({ bodyEmailTemplate: e.target.value })
                      }
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Use <code>{"{{from}}"}</code>, <code>{"{{subject}}"}</code>,{" "}
                    <code>{"{{body}}"}</code>, <code>{"{{agentOutput}}"}</code>,{" "}
                    <code>{"{{to}}"}</code> (redirect address from Integrations).
                  </p>
                </>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a node. Add <strong>Email / Forward</strong> to close
              support threads without leaving Ionex.
            </p>
          )}

          <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-3">
            <Label>Run trigger / brief</Label>
            <textarea
              className="min-h-[72px] rounded-md border border-white/10 bg-black/30 p-2 text-sm"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
            />
          </div>
          {status ? <p className="text-xs text-signal">{status}</p> : null}
        </aside>
      </div>
    </div>
  );
}
