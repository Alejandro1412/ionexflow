import { AGENT_MODE_META } from "@/lib/ai/modes";
import type { FlowEdge, FlowNode } from "@/lib/workflow/types";
import { defaultWorkflowGraph } from "@/lib/workflow/types";
import {
  SUPPORT_EMAIL_APPROVAL_MESSAGE,
  SUPPORT_EMAIL_CLASSIFIER_PROMPT,
  SUPPORT_EMAIL_FAQ_PROMPT,
  SUPPORT_EMAIL_FAQ_SYSTEM,
  SUPPORT_EMAIL_FORWARD_BODY,
  SUPPORT_EMAIL_SENSITIVE_PROMPT,
  SUPPORT_EMAIL_SENSITIVE_SYSTEM,
} from "@/lib/email/support-playbook";

export type AutomationTemplate = {
  id: string;
  name: string;
  category: "Marketing" | "Support" | "Sales" | "Ops";
  blurb: string;
  triggerHint: string;
  build: () => { nodes: FlowNode[]; edges: FlowEdge[] };
};

function supportTriageGraph(): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const support = AGENT_MODE_META.support;
  const nodes: FlowNode[] = [
    {
      id: "start-1",
      type: "workflow",
      position: { x: 40, y: 200 },
      data: { label: "Start", type: "start" },
    },
    {
      id: "class-1",
      type: "workflow",
      position: { x: 260, y: 200 },
      data: {
        label: "Triage classifier",
        type: "classifier",
        model: "gpt-4o-mini",
        routes: "needs_human,auto_reply",
        prompt:
          "Clasifica el ticket: needs_human si hay enojo, legal, reembolso, enterprise o datos sensibles; auto_reply si es FAQ simple.",
      },
    },
    {
      id: "agent-support",
      type: "workflow",
      position: { x: 520, y: 80 },
      data: {
        label: "Support reply agent",
        type: "agent",
        agentMode: "support",
        model: "gpt-4o-mini",
        prompt: support.defaultPrompt,
        systemPrompt: support.system,
      },
    },
    {
      id: "approval-1",
      type: "workflow",
      position: { x: 520, y: 320 },
      data: {
        label: "Supervisor approval",
        type: "approval",
        message: "Ticket sensible — revisa antes de responder al cliente.",
      },
    },
    {
      id: "agent-safe",
      type: "workflow",
      position: { x: 780, y: 80 },
      data: {
        label: "Polish auto-reply",
        type: "agent",
        agentMode: "rewrite",
        model: "gpt-4o-mini",
        prompt: AGENT_MODE_META.rewrite.defaultPrompt,
        systemPrompt: AGENT_MODE_META.rewrite.system,
      },
    },
    {
      id: "end-1",
      type: "workflow",
      position: { x: 1040, y: 200 },
      data: { label: "End", type: "end" },
    },
  ];

  const edges: FlowEdge[] = [
    { id: "e1", source: "start-1", target: "class-1" },
    {
      id: "e2",
      source: "class-1",
      target: "approval-1",
      sourceHandle: "needs_human",
      label: "needs_human",
    },
    {
      id: "e3",
      source: "class-1",
      target: "agent-support",
      sourceHandle: "auto_reply",
      label: "auto_reply",
    },
    { id: "e4", source: "approval-1", target: "agent-support" },
    { id: "e5", source: "agent-support", target: "agent-safe" },
    { id: "e6", source: "agent-safe", target: "end-1" },
  ];

  return { nodes, edges };
}

function salesQualifyGraph(): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const sales = AGENT_MODE_META.sales;
  const research = AGENT_MODE_META.research;
  const nodes: FlowNode[] = [
    {
      id: "start-1",
      type: "workflow",
      position: { x: 40, y: 200 },
      data: { label: "Start", type: "start" },
    },
    {
      id: "agent-research",
      type: "workflow",
      position: { x: 260, y: 200 },
      data: {
        label: "Lead research",
        type: "agent",
        agentMode: "research",
        model: "gpt-4o-mini",
        prompt: "Investiga el lead del trigger: ICP fit, señales de compra, riesgos.",
        systemPrompt: research.system,
      },
    },
    {
      id: "class-1",
      type: "workflow",
      position: { x: 520, y: 200 },
      data: {
        label: "Lead scorer",
        type: "classifier",
        model: "gpt-4o-mini",
        routes: "hot,warm_cold",
        prompt:
          "Clasifica hot si enterprise / urgencia / presupuesto; warm_cold en caso contrario.",
      },
    },
    {
      id: "approval-1",
      type: "workflow",
      position: { x: 780, y: 80 },
      data: {
        label: "AE approval",
        type: "approval",
        message: "Lead HOT — aprueba el outreach antes de enviar.",
      },
    },
    {
      id: "agent-sales",
      type: "workflow",
      position: { x: 780, y: 320 },
      data: {
        label: "Outreach agent",
        type: "agent",
        agentMode: "sales",
        model: "gpt-4o-mini",
        prompt: sales.defaultPrompt,
        systemPrompt: sales.system,
      },
    },
    {
      id: "end-1",
      type: "workflow",
      position: { x: 1040, y: 200 },
      data: { label: "End", type: "end" },
    },
  ];

  const edges: FlowEdge[] = [
    { id: "e1", source: "start-1", target: "agent-research" },
    { id: "e2", source: "agent-research", target: "class-1" },
    {
      id: "e3",
      source: "class-1",
      target: "approval-1",
      sourceHandle: "hot",
      label: "hot",
    },
    {
      id: "e4",
      source: "class-1",
      target: "agent-sales",
      sourceHandle: "warm_cold",
      label: "warm_cold",
    },
    { id: "e5", source: "approval-1", target: "agent-sales" },
    { id: "e6", source: "agent-sales", target: "end-1" },
  ];

  return { nodes, edges };
}

function opsPlaybookGraph(): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const ops = AGENT_MODE_META.ops;
  const extract = AGENT_MODE_META.extract;
  const nodes: FlowNode[] = [
    {
      id: "start-1",
      type: "workflow",
      position: { x: 60, y: 160 },
      data: { label: "Start", type: "start" },
    },
    {
      id: "agent-extract",
      type: "workflow",
      position: { x: 300, y: 160 },
      data: {
        label: "Extract facts",
        type: "agent",
        agentMode: "extract",
        model: "gpt-4o-mini",
        prompt: extract.defaultPrompt,
        systemPrompt: extract.system,
      },
    },
    {
      id: "agent-ops",
      type: "workflow",
      position: { x: 560, y: 160 },
      data: {
        label: "Build playbook",
        type: "agent",
        agentMode: "ops",
        model: "gpt-4o-mini",
        prompt: ops.defaultPrompt,
        systemPrompt: ops.system,
      },
    },
    {
      id: "approval-1",
      type: "workflow",
      position: { x: 820, y: 160 },
      data: {
        label: "Ops lead approval",
        type: "approval",
        message: "Valida el playbook antes de asignarlo al equipo.",
      },
    },
    {
      id: "end-1",
      type: "workflow",
      position: { x: 1060, y: 160 },
      data: { label: "End", type: "end" },
    },
  ];

  const edges: FlowEdge[] = [
    { id: "e1", source: "start-1", target: "agent-extract" },
    { id: "e2", source: "agent-extract", target: "agent-ops" },
    { id: "e3", source: "agent-ops", target: "approval-1" },
    { id: "e4", source: "approval-1", target: "end-1" },
  ];

  return { nodes, edges };
}

function contentRewriteGraph(): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const draft = AGENT_MODE_META.draft;
  const rewrite = AGENT_MODE_META.rewrite;
  const nodes: FlowNode[] = [
    {
      id: "start-1",
      type: "workflow",
      position: { x: 60, y: 160 },
      data: { label: "Start", type: "start" },
    },
    {
      id: "agent-draft",
      type: "workflow",
      position: { x: 300, y: 160 },
      data: {
        label: "First draft",
        type: "agent",
        agentMode: "draft",
        model: "gpt-4o-mini",
        prompt: draft.defaultPrompt,
        systemPrompt: draft.system,
      },
    },
    {
      id: "agent-rewrite",
      type: "workflow",
      position: { x: 560, y: 160 },
      data: {
        label: "Editor rewrite",
        type: "agent",
        agentMode: "rewrite",
        model: "gpt-4o-mini",
        prompt: rewrite.defaultPrompt,
        systemPrompt: rewrite.system,
      },
    },
    {
      id: "approval-1",
      type: "workflow",
      position: { x: 820, y: 160 },
      data: {
        label: "Editor approval",
        type: "approval",
        message: "Aprueba la versión final editada.",
      },
    },
    {
      id: "end-1",
      type: "workflow",
      position: { x: 1060, y: 160 },
      data: { label: "End", type: "end" },
    },
  ];

  const edges: FlowEdge[] = [
    { id: "e1", source: "start-1", target: "agent-draft" },
    { id: "e2", source: "agent-draft", target: "agent-rewrite" },
    { id: "e3", source: "agent-rewrite", target: "approval-1" },
    { id: "e4", source: "approval-1", target: "end-1" },
  ];

  return { nodes, edges };
}

function contentPublishGraph(): { nodes: FlowNode[]; edges: FlowEdge[] } {
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
      position: { x: 240, y: 120 },
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
      position: { x: 480, y: 120 },
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
      position: { x: 720, y: 180 },
      data: {
        label: "Director approval",
        type: "approval",
        message:
          "Revisa el copy. Al aprobar, se enviará a Slack / webhook de publicación.",
      },
    },
    {
      id: "slack-1",
      type: "workflow",
      position: { x: 960, y: 80 },
      data: {
        label: "Notify Slack",
        type: "slack",
        url: "https://hooks.slack.com/services/REPLACE/ME/TOKEN",
        message:
          "*IonexFlow* — copy aprobado\n\n{{agentOutput}}\n\n_Trigger:_ {{trigger}}",
        failOnError: false,
      },
    },
    {
      id: "webhook-1",
      type: "workflow",
      position: { x: 960, y: 260 },
      data: {
        label: "Publish webhook",
        type: "webhook",
        url: "https://example.com/hooks/ionexflow",
        bodyTemplate:
          '{\n  "source": "ionexflow",\n  "status": "approved",\n  "content": "{{agentOutput}}",\n  "trigger": "{{trigger}}"\n}',
        failOnError: false,
      },
    },
    {
      id: "end-1",
      type: "workflow",
      position: { x: 1200, y: 180 },
      data: { label: "End", type: "end" },
    },
  ];

  const edges: FlowEdge[] = [
    { id: "e1", source: "start-1", target: "agent-research" },
    { id: "e2", source: "agent-research", target: "agent-draft" },
    { id: "e3", source: "agent-draft", target: "approval-1" },
    { id: "e4", source: "approval-1", target: "slack-1" },
    { id: "e5", source: "slack-1", target: "webhook-1" },
    { id: "e6", source: "webhook-1", target: "end-1" },
  ];

  return { nodes, edges };
}

function supportEmailGraph(): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = [
    {
      id: "start-1",
      type: "workflow",
      position: { x: 40, y: 220 },
      data: { label: "Email received", type: "start" },
    },
    {
      id: "class-1",
      type: "workflow",
      position: { x: 260, y: 220 },
      data: {
        label: "Triage email",
        type: "classifier",
        model: "gpt-4o-mini",
        routes: "auto_reply,needs_human,redirect",
        prompt: SUPPORT_EMAIL_CLASSIFIER_PROMPT,
      },
    },
    {
      id: "agent-auto",
      type: "workflow",
      position: { x: 540, y: 40 },
      data: {
        label: "FAQ reply agent",
        type: "agent",
        agentMode: "support",
        model: "gpt-4o-mini",
        prompt: SUPPORT_EMAIL_FAQ_PROMPT,
        systemPrompt: SUPPORT_EMAIL_FAQ_SYSTEM,
      },
    },
    {
      id: "send-auto",
      type: "workflow",
      position: { x: 800, y: 40 },
      data: {
        label: "Send auto-reply",
        type: "email_send",
        toTemplate: "{{from}}",
        subjectTemplate: "Re: {{subject}}",
        bodyEmailTemplate: "{{agentOutput}}",
        failOnError: false,
      },
    },
    {
      id: "agent-human",
      type: "workflow",
      position: { x: 540, y: 220 },
      data: {
        label: "Sensitive draft agent",
        type: "agent",
        agentMode: "support",
        model: "gpt-4o-mini",
        prompt: SUPPORT_EMAIL_SENSITIVE_PROMPT,
        systemPrompt: SUPPORT_EMAIL_SENSITIVE_SYSTEM,
      },
    },
    {
      id: "approval-1",
      type: "workflow",
      position: { x: 800, y: 220 },
      data: {
        label: "Human approval",
        type: "approval",
        message: SUPPORT_EMAIL_APPROVAL_MESSAGE,
      },
    },
    {
      id: "send-human",
      type: "workflow",
      position: { x: 1040, y: 220 },
      data: {
        label: "Send approved reply",
        type: "email_send",
        toTemplate: "{{from}}",
        subjectTemplate: "Re: {{subject}}",
        bodyEmailTemplate: "{{agentOutput}}",
        failOnError: false,
      },
    },
    {
      id: "forward-1",
      type: "workflow",
      position: { x: 540, y: 400 },
      data: {
        label: "Redirect team",
        type: "email_forward",
        toTemplate: "{{to}}",
        subjectTemplate: "[Ionex redirect] {{subject}}",
        bodyEmailTemplate: SUPPORT_EMAIL_FORWARD_BODY,
        failOnError: false,
      },
    },
    {
      id: "end-1",
      type: "workflow",
      position: { x: 1280, y: 220 },
      data: { label: "End", type: "end" },
    },
  ];

  const edges: FlowEdge[] = [
    { id: "e1", source: "start-1", target: "class-1" },
    {
      id: "e2",
      source: "class-1",
      target: "agent-auto",
      sourceHandle: "auto_reply",
      label: "auto_reply",
    },
    {
      id: "e3",
      source: "class-1",
      target: "agent-human",
      sourceHandle: "needs_human",
      label: "needs_human",
    },
    {
      id: "e4",
      source: "class-1",
      target: "forward-1",
      sourceHandle: "redirect",
      label: "redirect",
    },
    { id: "e5", source: "agent-auto", target: "send-auto" },
    { id: "e6", source: "send-auto", target: "end-1" },
    { id: "e7", source: "agent-human", target: "approval-1" },
    { id: "e8", source: "approval-1", target: "send-human" },
    { id: "e9", source: "send-human", target: "end-1" },
    { id: "e10", source: "forward-1", target: "end-1" },
  ];

  return { nodes, edges };
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "content-marketing",
    name: "Content marketing",
    category: "Marketing",
    blurb: "Research → draft LinkedIn → director approval.",
    triggerHint:
      "Cliente SaaS B2B. Post LinkedIn sobre aprobaciones humanas en flujos de IA. Tono serio.",
    build: defaultWorkflowGraph,
  },
  {
    id: "content-publish",
    name: "Content + publish hooks",
    category: "Marketing",
    blurb:
      "Research → draft → approval → Slack + outbound webhook (Buffer/Zapier/Make).",
    triggerHint:
      "Brief de campaña + tono de marca. Sustituye las URLs de Slack/webhook antes de Run.",
    build: contentPublishGraph,
  },
  {
    id: "content-rewrite",
    name: "Draft + editor rewrite",
    category: "Marketing",
    blurb: "Dos agentes en cadena: redacta y luego reescribe con editor AI.",
    triggerHint: "Brief creativo + audience + CTA deseado.",
    build: contentRewriteGraph,
  },
  {
    id: "support-triage",
    name: "Support triage",
    category: "Support",
    blurb: "Clasifica tickets: sensibles a humano, FAQ a auto-reply + polish.",
    triggerHint:
      "Ticket: Cliente enfadado pide reembolso por downtime. Plan Enterprise.",
    build: supportTriageGraph,
  },
  {
    id: "support-email",
    name: "Support email inbox",
    category: "Support",
    blurb:
      "Playbook listo: triage FAQ / sensible / redirect + respuestas preescritas. Solo conecta el buzón y úsalo.",
    triggerHint:
      "From: cliente@acme.com | Subject: Reembolso | Body: furioso, Enterprise, downtime.",
    build: supportEmailGraph,
  },
  {
    id: "sales-qualify",
    name: "Sales lead qualify",
    category: "Sales",
    blurb: "Research → score hot/warm → approval si hot → outreach.",
    triggerHint:
      "Lead: VP Ops en fintech 200 empleados, pide demo esta semana, presupuesto abierto.",
    build: salesQualifyGraph,
  },
  {
    id: "ops-playbook",
    name: "Ops playbook builder",
    category: "Ops",
    blurb: "Extrae hechos y convierte notas en checklist operativo aprobable.",
    triggerHint:
      "Notas de reunión: migrar billing a Stripe, due viernes, owner Ana, riesgo: webhooks.",
    build: opsPlaybookGraph,
  },
];

export function getAutomationTemplate(id: string) {
  return AUTOMATION_TEMPLATES.find((t) => t.id === id) ?? null;
}
