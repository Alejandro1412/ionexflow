import { generateWithMode, generateAgentOutput } from "@/lib/ai/provider";
import type { AgentMode } from "@/lib/ai/modes";
import { nextNodeId } from "@/lib/engine/graph";
import { executeHttpRequest, renderTemplate } from "@/lib/engine/http";
import { sendOutboundEmail } from "@/lib/email/send";
import type {
  ExecutionLogEntry,
  FlowEdge,
  FlowNode,
  FlowNodeData,
} from "@/lib/workflow/types";
import { parseRoutes } from "@/lib/workflow/types";

export type RunnerResult =
  | { kind: "completed"; logs: ExecutionLogEntry[] }
  | { kind: "failed"; logs: ExecutionLogEntry[]; error: string }
  | {
      kind: "paused";
      logs: ExecutionLogEntry[];
      approvalNodeId: string;
      approvalPayload: Record<string, unknown>;
    }
  | {
      kind: "waiting";
      logs: ExecutionLogEntry[];
      waitingNodeId: string;
      resumeAt: string;
    };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries<T>(
  attempts: number,
  fn: (attempt: number) => Promise<T>,
  isOk: (value: T) => boolean
): Promise<T> {
  let last!: T;
  const max = Math.max(1, Math.min(5, attempts));
  for (let attempt = 1; attempt <= max; attempt++) {
    last = await fn(attempt);
    if (isOk(last) || attempt === max) return last;
    await sleep(400 * Math.pow(2, attempt - 1));
  }
  return last;
}

function log(
  nodeId: string,
  message: string,
  level: ExecutionLogEntry["level"] = "info",
  extra?: Partial<ExecutionLogEntry>
): ExecutionLogEntry {
  return { at: new Date().toISOString(), nodeId, level, message, ...extra };
}

function getData(node: FlowNode): FlowNodeData {
  return node.data;
}

function lastAgentOutput(logs: ExecutionLogEntry[]) {
  for (let i = logs.length - 1; i >= 0; i--) {
    const entry = logs[i]!;
    if (entry.kind === "agent_output" && entry.output) {
      return entry;
    }
  }
  return null;
}

function templateVars(
  data: FlowNodeData,
  logs: ExecutionLogEntry[],
  context: Record<string, string>,
  triggerPayload: Record<string, unknown>
) {
  const latest = lastAgentOutput(logs);
  const email =
    (triggerPayload.email as Record<string, string> | undefined) ?? {};
  return {
    agentOutput: latest?.output ?? "",
    trigger: String(triggerPayload.input ?? JSON.stringify(triggerPayload)),
    label: data.label,
    from: String(email.from ?? triggerPayload.from ?? ""),
    to: String(email.to ?? triggerPayload.to ?? ""),
    subject: String(email.subject ?? triggerPayload.subject ?? ""),
    body: String(email.body ?? triggerPayload.body ?? triggerPayload.input ?? ""),
    context,
  };
}

async function runEmailNode(options: {
  node: FlowNode;
  data: FlowNodeData;
  logs: ExecutionLogEntry[];
  context: Record<string, string>;
  triggerPayload: Record<string, unknown>;
  mode: "email_send" | "email_forward";
  dryRun?: boolean;
}): Promise<"ok" | { error: string }> {
  const { node, data, logs, context, triggerPayload, mode, dryRun } = options;
  const vars = templateVars(data, logs, context, triggerPayload);
  const failOnError = data.failOnError !== false;

  const to =
    renderTemplate(
      data.toTemplate?.trim() ||
        (mode === "email_forward" ? "{{to}}" : "{{from}}"),
      vars
    ).trim() || (mode === "email_send" ? vars.from : "");

  const subject = renderTemplate(
    data.subjectTemplate?.trim() ||
      (mode === "email_forward"
        ? "Fwd: {{subject}}"
        : "Re: {{subject}}"),
    vars
  );

  const text = renderTemplate(
    data.bodyEmailTemplate?.trim() ||
      (mode === "email_forward"
        ? "Forwarded by IonexFlow.\n\nFrom: {{from}}\nSubject: {{subject}}\n\n{{body}}\n\n---\nAgent note:\n{{agentOutput}}"
        : "{{agentOutput}}"),
    vars
  );

  if (!to) {
    const message = `${mode} node "${data.label}" has no recipient`;
    logs.push(log(node.id, message, "error"));
    return { error: message };
  }

  if (dryRun) {
    const summary = `[dry-run] would ${mode === "email_forward" ? "forward" : "send"} email to ${to}`;
    context[data.label] = summary;
    logs.push(
      log(node.id, summary, "warn", {
        kind: "email_output",
        output: text,
        provider: "dry-run",
      })
    );
    return "ok";
  }

  logs.push(
    log(
      node.id,
      `${mode === "email_forward" ? "Forwarding" : "Sending"} email to ${to}…`
    )
  );

  const result = await sendOutboundEmail({
    to,
    subject,
    text,
    from: data.fromAddress,
    replyTo: vars.from || undefined,
    orgId: String(triggerPayload.orgId ?? ""),
    connectionId: triggerPayload.emailConnectionId
      ? String(triggerPayload.emailConnectionId)
      : null,
  });

  const summary = result.ok
    ? `sent via ${result.provider} (${result.id ?? "ok"}) → ${to}`
    : result.error ?? "send failed";

  context[data.label] = summary;
  logs.push(
    log(node.id, summary, result.ok ? "success" : "error", {
      kind: "email_output",
      output: text,
      provider: result.provider,
    })
  );

  if (!result.ok && failOnError) {
    return { error: result.error ?? "Email send failed" };
  }
  return "ok";
}

async function runOutboundNode(options: {
  node: FlowNode;
  data: FlowNodeData;
  logs: ExecutionLogEntry[];
  context: Record<string, string>;
  triggerPayload: Record<string, unknown>;
  mode: "http" | "slack" | "webhook";
  dryRun?: boolean;
}): Promise<"ok" | { error: string }> {
  const { node, data, logs, context, triggerPayload, mode, dryRun } = options;
  const vars = templateVars(data, logs, context, triggerPayload);
  const failOnError = data.failOnError !== false;

  if (!data.url?.trim()) {
    const message = `${mode} node "${data.label}" has no URL configured`;
    logs.push(log(node.id, message, "error"));
    return { error: message };
  }

  if (dryRun) {
    const summary = `[dry-run] would ${mode.toUpperCase()} ${data.method ?? "POST"} ${data.url.trim()}`;
    context[data.label] = summary;
    logs.push(
      log(node.id, summary, "warn", {
        kind: "http_output",
        output: summary,
        statusCode: 0,
        latencyMs: 0,
      })
    );
    return "ok";
  }

  let method = data.method ?? "POST";
  let headersJson = data.headersJson;
  let bodyTemplate = data.bodyTemplate;

  if (mode === "slack") {
    method = "POST";
    headersJson = JSON.stringify({ "Content-Type": "application/json" });
    const text = renderTemplate(
      data.message?.trim() ||
        data.bodyTemplate?.trim() ||
        "IonexFlow approval completed.\n\n{{agentOutput}}",
      vars
    );
    bodyTemplate = JSON.stringify({ text });
  } else if (mode === "webhook") {
    method = "POST";
    if (!headersJson?.trim()) {
      headersJson = JSON.stringify({ "Content-Type": "application/json" });
    }
    bodyTemplate =
      data.bodyTemplate?.trim() ||
      JSON.stringify(
        {
          source: "ionexflow",
          label: data.label,
          trigger: "{{trigger}}",
          content: "{{agentOutput}}",
        },
        null,
        2
      );
  }

  logs.push(
    log(
      node.id,
      `${mode.toUpperCase()} "${data.label}" → ${method} ${data.url.trim()}`
    )
  );

  try {
    const result = await executeHttpRequest({
      url: data.url,
      method,
      headersJson,
      bodyTemplate,
      vars,
    });

    const summary = `${result.status} ${result.statusText} (${result.latencyMs}ms)`;
    context[data.label] = result.bodyPreview || summary;

    if (!result.ok && failOnError) {
      logs.push(
        log(node.id, `${mode} failed: ${summary}`, "error", {
          kind: "http_output",
          output: result.bodyPreview,
          statusCode: result.status,
          latencyMs: result.latencyMs,
        })
      );
      return { error: `${mode} request failed with ${result.status}` };
    }

    logs.push(
      log(
        node.id,
        `${mode} ${result.ok ? "ok" : "non-OK (continued)"}: ${summary}`,
        result.ok ? "success" : "warn",
        {
          kind: "http_output",
          output: result.bodyPreview,
          statusCode: result.status,
          latencyMs: result.latencyMs,
        }
      )
    );
    return "ok";
  } catch (error) {
    const message = error instanceof Error ? error.message : `${mode} failed`;
    logs.push(log(node.id, message, "error"));
    return { error: message };
  }
}

/**
 * Walks the graph: agents, classifiers, approvals, HTTP/Slack/Webhook.
 */
export async function runWorkflowGraph(options: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  fromNodeId?: string | null;
  skipCurrent?: boolean;
  triggerPayload?: Record<string, unknown>;
  existingLogs?: ExecutionLogEntry[];
  /** Stub HTTP/Slack/Webhook/Email side effects; skip real Delay waits. */
  dryRun?: boolean;
}): Promise<RunnerResult> {
  const { nodes, edges, triggerPayload = {}, existingLogs = [] } = options;
  const dryRun = Boolean(options.dryRun ?? triggerPayload.dryRun);
  const logs = [...existingLogs];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const context: Record<string, string> = {};
  const orgId =
    typeof triggerPayload.orgId === "string" ? triggerPayload.orgId : undefined;

  if (dryRun) {
    logs.push(
      log(
        "system",
        "Test run: external side effects (email/HTTP/Slack/webhook) are stubbed; delays are skipped.",
        "warn"
      )
    );
  }

  for (const entry of existingLogs) {
    if (
      (entry.kind === "agent_output" || entry.kind === "http_output") &&
      entry.output
    ) {
      const node = byId.get(entry.nodeId);
      const key = node ? getData(node).label : entry.nodeId;
      context[key] = entry.output;
    }
  }

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
        const prompt = data.prompt?.trim() || "No prompt configured";
        const mode = (data.agentMode ?? "general") as AgentMode;
        const maxAttempts = (data.maxRetries ?? 2) + 1;
        logs.push(
          log(node.id, `Agent "${data.label}" [${mode}] invoking intelligence…`)
        );

        try {
          let lastError: unknown;
          let result: Awaited<ReturnType<typeof generateWithMode>> | null = null;
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              if (attempt > 1) {
                logs.push(
                  log(
                    node.id,
                    `Agent retry ${attempt}/${maxAttempts}…`,
                    "warn"
                  )
                );
                await sleep(400 * Math.pow(2, attempt - 2));
              }
              result = await generateWithMode({
                agentLabel: data.label,
                prompt,
                mode,
                systemPrompt: data.systemPrompt,
                model: data.model,
                temperature: data.temperature,
                triggerPayload,
                context,
                orgId,
                source: "agent",
              });
              lastError = null;
              break;
            } catch (error) {
              lastError = error;
            }
          }
          if (!result) {
            throw lastError instanceof Error
              ? lastError
              : new Error("Agent failed");
          }

          context[data.label] = result.text;
          const modeLabel = result.demo ? "demo intelligence" : result.provider;
          if (result.notice) {
            logs.push(log(node.id, result.notice, "warn"));
          }
          logs.push(
            log(
              node.id,
              `Agent "${data.label}" completed via ${modeLabel} (${result.model}, ${result.latencyMs}ms)`,
              "success",
              {
                kind: "agent_output",
                output: result.text,
                model: result.model,
                provider: result.provider,
                latencyMs: result.latencyMs,
              }
            )
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Agent failed";
          logs.push(log(node.id, message, "error"));
          return { kind: "failed", logs, error: message };
        }

        currentId = nextNodeId(node.id, edges);
        break;
      }
      case "classifier": {
        const routes = parseRoutes(data.routes);
        const prompt =
          data.prompt?.trim() ||
          `Classify into one of: ${routes.join(", ")}`;
        logs.push(
          log(
            node.id,
            `Classifier "${data.label}" routing across [${routes.join(", ")}]…`
          )
        );

        try {
          const result = await generateAgentOutput({
            agentLabel: data.label,
            prompt,
            systemPrompt:
              data.systemPrompt ||
              "You are a strict router. Reply with exactly one route key.",
            model: data.model,
            temperature: 0,
            triggerPayload,
            context,
            classifyRoutes: routes,
            orgId,
            source: "classifier",
          });

          const route = result.route ?? routes[0]!;
          context[data.label] = `route=${route}`;
          if (result.notice) {
            logs.push(log(node.id, result.notice, "warn"));
          }
          logs.push(
            log(
              node.id,
              `Routed to "${route}" via ${result.demo ? "demo" : result.provider} (${result.latencyMs}ms)`,
              "success",
              {
                kind: "route",
                output: route,
                route,
                model: result.model,
                provider: result.provider,
                latencyMs: result.latencyMs,
              }
            )
          );
          currentId = nextNodeId(node.id, edges, route);
          if (!currentId) {
            return {
              kind: "failed",
              logs,
              error: `No edge for classifier route "${route}" on ${node.id}`,
            };
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Classifier failed";
          logs.push(log(node.id, message, "error"));
          return { kind: "failed", logs, error: message };
        }
        break;
      }
      case "http":
      case "slack":
      case "webhook": {
        const maxAttempts = (data.maxRetries ?? 2) + 1;
        const outbound = await withRetries(
          maxAttempts,
          async (attempt) => {
            if (attempt > 1) {
              logs.push(
                log(
                  node.id,
                  `${data.type} retry ${attempt}/${maxAttempts}…`,
                  "warn"
                )
              );
            }
            return runOutboundNode({
              node,
              data,
              logs,
              context,
              triggerPayload,
              mode: data.type as "http" | "slack" | "webhook",
              dryRun,
            });
          },
          (value) => value === "ok"
        );
        if (outbound !== "ok") {
          return { kind: "failed", logs, error: outbound.error };
        }
        currentId = nextNodeId(node.id, edges);
        break;
      }
      case "email_send":
      case "email_forward": {
        const maxAttempts = (data.maxRetries ?? 2) + 1;
        const mail = await withRetries(
          maxAttempts,
          async (attempt) => {
            if (attempt > 1) {
              logs.push(
                log(
                  node.id,
                  `${data.type} retry ${attempt}/${maxAttempts}…`,
                  "warn"
                )
              );
            }
            return runEmailNode({
              node,
              data,
              logs,
              context,
              triggerPayload,
              mode: data.type as "email_send" | "email_forward",
              dryRun,
            });
          },
          (value) => value === "ok"
        );
        if (mail !== "ok") {
          return { kind: "failed", logs, error: mail.error };
        }
        currentId = nextNodeId(node.id, edges);
        break;
      }
      case "delay": {
        const minutes = Math.max(
          1,
          Math.min(10080, Number(data.waitMinutes ?? 60) || 60)
        );
        if (dryRun) {
          logs.push(
            log(
              node.id,
              `[dry-run] delay of ${minutes} minute(s) skipped`,
              "warn"
            )
          );
          currentId = nextNodeId(node.id, edges);
          break;
        }
        const resumeAt = new Date(Date.now() + minutes * 60_000).toISOString();
        logs.push(
          log(
            node.id,
            `Waiting ${minutes} minute(s) until ${resumeAt}`,
            "warn"
          )
        );
        return {
          kind: "waiting",
          logs,
          waitingNodeId: node.id,
          resumeAt,
        };
      }
      case "approval": {
        const latest = lastAgentOutput(logs);
        logs.push(
          log(
            node.id,
            `Paused for approval: ${data.message ?? data.label}`,
            "warn"
          )
        );
        return {
          kind: "paused",
          logs,
          approvalNodeId: node.id,
          approvalPayload: {
            label: data.label,
            message: data.message ?? "Please approve to continue.",
            agentOutput: latest?.output ?? null,
            agentLabel: latest
              ? byId.get(latest.nodeId)
                ? getData(byId.get(latest.nodeId)!).label
                : latest.nodeId
              : null,
            model: latest?.model ?? null,
            provider: latest?.provider ?? null,
            latencyMs: latest?.latencyMs ?? null,
            context,
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
