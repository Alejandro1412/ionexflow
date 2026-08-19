/**
 * Template helpers for HTTP / Slack / Webhook nodes.
 * Supports {{agentOutput}}, {{trigger}}, {{label}}, {{context.NodeLabel}}.
 */

export type TemplateContext = {
  agentOutput?: string | null;
  trigger?: string | null;
  label?: string | null;
  from?: string | null;
  to?: string | null;
  subject?: string | null;
  body?: string | null;
  context?: Record<string, string>;
};

export function renderTemplate(
  template: string,
  vars: TemplateContext
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, raw: string) => {
    const key = raw.trim();
    if (key === "agentOutput") return vars.agentOutput ?? "";
    if (key === "trigger") return vars.trigger ?? "";
    if (key === "label") return vars.label ?? "";
    if (key === "from") return vars.from ?? "";
    if (key === "to") return vars.to ?? "";
    if (key === "subject") return vars.subject ?? "";
    if (key === "body") return vars.body ?? "";
    if (key.startsWith("context.")) {
      const name = key.slice("context.".length);
      return vars.context?.[name] ?? "";
    }
    return "";
  });
}

export function assertPublicHttpUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  return parsed;
}

export function parseHeadersJson(raw?: string): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Headers must be a JSON object");
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      out[k] = String(v);
    }
    return out;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Invalid headers JSON"
    );
  }
}

export type HttpRequestResult = {
  ok: boolean;
  status: number;
  statusText: string;
  bodyPreview: string;
  latencyMs: number;
};

export async function executeHttpRequest(options: {
  url: string;
  method?: string;
  headersJson?: string;
  bodyTemplate?: string;
  vars: TemplateContext;
  timeoutMs?: number;
}): Promise<HttpRequestResult> {
  const url = assertPublicHttpUrl(options.url.trim());
  const method = (options.method ?? "POST").toUpperCase();
  const headers = parseHeadersJson(options.headersJson);
  const body =
    options.bodyTemplate != null && options.bodyTemplate !== ""
      ? renderTemplate(options.bodyTemplate, options.vars)
      : undefined;

  if (body && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 20_000
  );

  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : body,
      signal: controller.signal,
    });
    const text = await res.text();
    const preview =
      text.length > 4_000 ? `${text.slice(0, 4_000)}…[truncated]` : text;
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      bodyPreview: preview,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}
