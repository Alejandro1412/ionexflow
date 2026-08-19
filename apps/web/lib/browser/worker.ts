/**
 * Optional external browser worker (Playwright/Puppeteer service).
 * If BROWSER_WORKER_URL is unset, runs in simulate mode (logs planned steps).
 */
export async function runBrowserAgentSteps(options: {
  url: string;
  stepsJson: string;
  dryRun?: boolean;
}): Promise<{ ok: boolean; output: string; provider: string; error?: string }> {
  const url = options.url.trim();
  const stepsRaw = options.stepsJson.trim() || "[]";

  let steps: unknown;
  try {
    steps = JSON.parse(stepsRaw);
  } catch {
    return {
      ok: false,
      output: "",
      provider: "browser",
      error: "browserStepsJson must be valid JSON array",
    };
  }

  if (!url) {
    return {
      ok: false,
      output: "",
      provider: "browser",
      error: "browserUrl is required",
    };
  }

  if (options.dryRun) {
    return {
      ok: true,
      output: `[dry-run] would open ${url} and run ${Array.isArray(steps) ? steps.length : 0} steps:\n${JSON.stringify(steps, null, 2)}`,
      provider: "dry-run",
    };
  }

  const worker = process.env.BROWSER_WORKER_URL?.trim();
  const secret = process.env.BROWSER_WORKER_SECRET?.trim();

  if (!worker) {
    return {
      ok: true,
      output: [
        `[simulate] Browser agent (no BROWSER_WORKER_URL configured).`,
        `Target: ${url}`,
        `Steps:`,
        JSON.stringify(steps, null, 2),
        ``,
        `Connect a headless browser worker to execute real clicks/forms.`,
      ].join("\n"),
      provider: "simulate",
    };
  }

  try {
    const res = await fetch(worker.replace(/\/$/, "") + "/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ url, steps }),
      signal: AbortSignal.timeout(55_000),
    });
    const text = await res.text();
    let parsed: { output?: string; error?: string } = {};
    try {
      parsed = JSON.parse(text) as { output?: string; error?: string };
    } catch {
      parsed = { output: text };
    }
    if (!res.ok) {
      return {
        ok: false,
        output: parsed.output ?? text,
        provider: "browser-worker",
        error: parsed.error ?? `Worker HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      output: parsed.output ?? text,
      provider: "browser-worker",
    };
  } catch (error) {
    return {
      ok: false,
      output: "",
      provider: "browser-worker",
      error: error instanceof Error ? error.message : "Browser worker failed",
    };
  }
}
