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
import { saveWorkflow, restoreWorkflowVersion } from "@/actions/workflows";
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
  condition: "border-lime-400/50 bg-lime-500/10",
  approval: "border-amber-400/60 bg-amber-500/10",
  delay: "border-yellow-400/50 bg-yellow-500/10",
  http: "border-sky-400/60 bg-sky-500/10",
  slack: "border-fuchsia-400/50 bg-fuchsia-500/10",
  webhook: "border-cyan-400/50 bg-cyan-500/10",
  email_send: "border-teal-400/60 bg-teal-500/10",
  email_forward: "border-orange-400/50 bg-orange-500/10",
  whatsapp_send: "border-emerald-500/50 bg-emerald-500/10",
  browser_agent: "border-orange-500/50 bg-orange-500/10",
  document_extract: "border-indigo-400/50 bg-indigo-500/10",
  end: "border-arc/50 bg-arc/10",
};

function WorkflowNodeView({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  const routes =
    data.type === "classifier"
      ? parseRoutes(data.routes)
      : data.type === "condition"
        ? ["true", "false"]
        : [];

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
      {data.type === "classifier" || data.type === "condition" ? (
        <p className="mt-1 text-[10px] text-violet-200/90">
          routes: {routes.join(" | ")}
        </p>
      ) : null}
      {data.type === "condition" ? (
        <p className="mt-1 truncate text-[10px] text-lime-200/90">
          {data.conditionLeft || "left"} {data.conditionOp || "eq"}{" "}
          {data.conditionRight || "right"}
        </p>
      ) : null}
      {data.type === "approval" && data.slaMinutes ? (
        <p className="mt-1 text-[10px] text-amber-200/90">
          SLA {data.slaMinutes}m
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
      {data.type === "whatsapp_send" ? (
        <p className="mt-1 truncate text-[10px] text-emerald-200/90">
          WA → {data.waToTemplate || data.toTemplate || "{{from}}"}
        </p>
      ) : null}
      {data.type === "browser_agent" ? (
        <p className="mt-1 truncate text-[10px] text-orange-200/90">
          {data.browserUrl || data.url || "set URL"}
        </p>
      ) : null}
      {data.type === "document_extract" ? (
        <p className="mt-1 truncate text-[10px] text-indigo-200/90">
          extract · {data.extractFields || "fields"}
        </p>
      ) : null}
      {data.type === "agent" && data.useOrgKnowledge !== false ? (
        <p className="mt-1 text-[10px] text-muted-foreground">knowledge on</p>
      ) : null}
      {data.type === "classifier" || data.type === "condition" ? (
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
  initialVersions = [],
  aiStatus,
  generatedFromText = false,
}: {
  workflowId: string;
  initialName: string;
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
  initialActive: boolean;
  initialScheduleEnabled?: boolean;
  initialScheduleEveryMinutes?: number | null;
  initialVersions?: Array<{
    id: string;
    version: number;
    name: string;
    created_at: string;
  }>;
  aiStatus?: { live: boolean; label: string; hint: string };
  generatedFromText?: boolean;
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
  const [status, setStatus] = useState<string | null>(
    generatedFromText
      ? "Generado con IA (borrador inactivo). Revisa nodos → Test run → Activa cuando esté listo."
      : null
  );
  const [trigger, setTrigger] = useState(
    "Cliente SaaS B2B — brief real para automatizar con IA"
  );
  const [saving, setSaving] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [versions, setVersions] = useState(initialVersions);
  const [restoringId, setRestoringId] = useState<string | null>(null);

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
          : type === "condition"
            ? "Condition rule"
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
                      : type === "whatsapp_send"
                        ? "WhatsApp message"
                        : type === "browser_agent"
                          ? "Browser agent"
                          : type === "document_extract"
                            ? "Document extract"
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
            type === "email_forward" ||
            type === "whatsapp_send" ||
            type === "browser_agent"
              ? 2
              : undefined,
          agentMode: type === "agent" ? "general" : undefined,
          useOrgKnowledge: type === "agent" ? true : undefined,
          waToTemplate: type === "whatsapp_send" ? "{{from}}" : undefined,
          waBodyTemplate:
            type === "whatsapp_send" ? "{{agentOutput}}" : undefined,
          browserUrl:
            type === "browser_agent" ? "https://example.com" : undefined,
          browserStepsJson:
            type === "browser_agent"
              ? '[{"action":"goto"},{"action":"wait","ms":1000}]'
              : undefined,
          extractFields:
            type === "document_extract"
              ? "amount, vendor, date, invoice_number"
              : undefined,
          documentTemplate:
            type === "document_extract" ? "{{body}}" : undefined,
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
          conditionLeft: type === "condition" ? "{{trigger}}" : undefined,
          conditionOp: type === "condition" ? "contains" : undefined,
          conditionRight: type === "condition" ? "urgente" : undefined,
          slaMinutes: type === "approval" ? 240 : undefined,
          message:
            type === "approval"
              ? "Review agent output before continuing"
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
    if (!result?.error) {
      setVersions((prev) => [
        {
          id: `local-${Date.now()}`,
          version: (prev[0]?.version ?? 0) + 1,
          name,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 20));
    }
    setStatus(result?.error ?? "Saved (version snapshot)");
  }

  async function onRun(asTest: boolean) {
    setStatus(null);
    await onSave();
    await startExecution(workflowId, trigger, {
      dryRun: asTest || dryRun,
    });
  }

  async function onRestore(versionId: string) {
    setRestoringId(versionId);
    setStatus(null);
    const result = await restoreWorkflowVersion(workflowId, versionId);
    setRestoringId(null);
    if (result?.error) {
      setStatus(result.error);
      return;
    }
    setStatus("Version restored — reloading…");
    window.location.reload();
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-3">
      {generatedFromText ? (
        <div className="rounded-lg border border-signal/40 bg-signal/10 px-4 py-3 text-sm">
          <p className="font-semibold text-signal">
            Diagrama generado desde tu descripción
          </p>
          <p className="mt-1 text-muted-foreground">
            Está <strong>inactivo</strong>. Revisa nodos y plantillas (email al
            jefe, respuesta al cliente), haz <strong>Test run</strong>, y activa
            cuando esté listo. También puedes seguir editando a mano.
          </p>
        </div>
      ) : null}
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
        <Button type="button" variant="outline" onClick={() => addNode("condition")}>
          + Condition
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
        <Button type="button" variant="outline" onClick={() => addNode("whatsapp_send")}>
          + WhatsApp
        </Button>
        <Button type="button" variant="outline" onClick={() => addNode("browser_agent")}>
          + Browser
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => addNode("document_extract")}
        >
          + Extract doc
        </Button>
        <Button type="button" variant="outline" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onRun(true)}
          title="Stubs email/HTTP/Slack/webhook; skips delays"
        >
          Test run
        </Button>
        <Button type="button" onClick={() => onRun(false)}>
          {dryRun ? "Run (safe)" : "Run live"}
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          Safe mode (no external side effects)
        </label>
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
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={
                        (selected.data as FlowNodeData).useOrgKnowledge !== false
                      }
                      onChange={(e) =>
                        updateSelectedData({
                          useOrgKnowledge: e.target.checked,
                        })
                      }
                    />
                    Use company Knowledge
                  </label>
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
              {(selected.data as FlowNodeData).type === "condition" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <Label>Left (template)</Label>
                    <Input
                      value={(selected.data as FlowNodeData).conditionLeft ?? ""}
                      onChange={(e) =>
                        updateSelectedData({ conditionLeft: e.target.value })
                      }
                      placeholder="{{amount}} or {{trigger}}"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Operator</Label>
                    <select
                      className="rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm"
                      value={(selected.data as FlowNodeData).conditionOp ?? "eq"}
                      onChange={(e) =>
                        updateSelectedData({ conditionOp: e.target.value })
                      }
                    >
                      {[
                        "eq",
                        "neq",
                        "gt",
                        "gte",
                        "lt",
                        "lte",
                        "contains",
                        "exists",
                      ].map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Right (template)</Label>
                    <Input
                      value={
                        (selected.data as FlowNodeData).conditionRight ?? ""
                      }
                      onChange={(e) =>
                        updateSelectedData({ conditionRight: e.target.value })
                      }
                      placeholder="1000"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Connect handles <code>true</code> / <code>false</code>. No
                    LLM cost.
                  </p>
                </>
              ) : null}
              {(selected.data as FlowNodeData).type === "approval" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <Label>Message</Label>
                    <textarea
                      className="min-h-[80px] rounded-md border border-white/10 bg-black/30 p-2 text-sm"
                      value={(selected.data as FlowNodeData).message ?? ""}
                      onChange={(e) =>
                        updateSelectedData({ message: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>SLA minutes (0 = off)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10080}
                      value={(selected.data as FlowNodeData).slaMinutes ?? 0}
                      onChange={(e) =>
                        updateSelectedData({
                          slaMinutes: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Slack webhook (Approve/Reject buttons)</Label>
                    <Input
                      value={
                        (selected.data as FlowNodeData).approvalSlackWebhook ??
                        ""
                      }
                      onChange={(e) =>
                        updateSelectedData({
                          approvalSlackWebhook: e.target.value,
                        })
                      }
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>
                </>
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
              {(selected.data as FlowNodeData).type === "whatsapp_send" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <Label>To phone (template)</Label>
                    <Input
                      value={
                        (selected.data as FlowNodeData).waToTemplate ??
                        (selected.data as FlowNodeData).toTemplate ??
                        ""
                      }
                      onChange={(e) =>
                        updateSelectedData({ waToTemplate: e.target.value })
                      }
                      placeholder="{{from}} or 52155…"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Message body</Label>
                    <textarea
                      className="min-h-[100px] rounded-md border border-white/10 bg-black/30 p-2 text-sm"
                      value={
                        (selected.data as FlowNodeData).waBodyTemplate ??
                        (selected.data as FlowNodeData).bodyEmailTemplate ??
                        ""
                      }
                      onChange={(e) =>
                        updateSelectedData({ waBodyTemplate: e.target.value })
                      }
                    />
                  </div>
                </>
              ) : null}
              {(selected.data as FlowNodeData).type === "browser_agent" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <Label>Target URL</Label>
                    <Input
                      value={
                        (selected.data as FlowNodeData).browserUrl ??
                        (selected.data as FlowNodeData).url ??
                        ""
                      }
                      onChange={(e) =>
                        updateSelectedData({ browserUrl: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Steps JSON</Label>
                    <textarea
                      className="min-h-[120px] rounded-md border border-white/10 bg-black/30 p-2 font-mono text-xs"
                      value={(selected.data as FlowNodeData).browserStepsJson ?? ""}
                      onChange={(e) =>
                        updateSelectedData({ browserStepsJson: e.target.value })
                      }
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Without <code>BROWSER_WORKER_URL</code> runs in simulate mode.
                    Dry-run always stubs.
                  </p>
                </>
              ) : null}
              {(selected.data as FlowNodeData).type === "document_extract" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <Label>Document text template</Label>
                    <textarea
                      className="min-h-[80px] rounded-md border border-white/10 bg-black/30 p-2 text-sm"
                      value={
                        (selected.data as FlowNodeData).documentTemplate ??
                        "{{body}}"
                      }
                      onChange={(e) =>
                        updateSelectedData({ documentTemplate: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Fields to extract</Label>
                    <Input
                      value={(selected.data as FlowNodeData).extractFields ?? ""}
                      onChange={(e) =>
                        updateSelectedData({ extractFields: e.target.value })
                      }
                      placeholder="amount, vendor, date…"
                    />
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a node. Add <strong>WhatsApp / Email / Knowledge</strong> for
              real business channels.
            </p>
          )}

          <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-3">
            <div>
              <Label>Version history</Label>
              {versions.length === 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Save to create the first snapshot.
                </p>
              ) : (
                <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs">
                  {versions.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-2 rounded border border-white/5 bg-black/20 px-2 py-1"
                    >
                      <span className="truncate text-muted-foreground">
                        v{v.version} · {new Date(v.created_at).toLocaleString()}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-7 px-2 text-[10px]"
                        disabled={
                          restoringId === v.id || v.id.startsWith("local-")
                        }
                        onClick={() => onRestore(v.id)}
                      >
                        {restoringId === v.id ? "…" : "Restore"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
