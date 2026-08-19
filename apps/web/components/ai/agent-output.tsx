import type { ReactNode } from "react";

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/** Lightweight Markdown-ish renderer for agent outputs (headings, bullets, quotes). */
export function AgentMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      blocks.push(
        <h4 key={`h4-${blocks.length}`} className="mt-4 font-display text-sm font-semibold text-signal">
          {line.slice(4)}
        </h4>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="mt-5 font-display text-base font-bold tracking-tight">
          {line.slice(3)}
        </h3>
      );
      continue;
    }
    if (line.startsWith("> ")) {
      flushList();
      blocks.push(
        <blockquote
          key={`bq-${blocks.length}`}
          className="my-2 border-l-2 border-signal/50 bg-signal/5 px-3 py-2 text-sm text-muted-foreground"
        >
          {renderInline(line.slice(2))}
        </blockquote>
      );
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      listItems.push(line.slice(2));
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      listItems.push(line.replace(/^\d+\.\s/, ""));
      continue;
    }
    flushList();
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-1.5 text-sm leading-relaxed text-foreground/90">
        {renderInline(line)}
      </p>
    );
  }
  flushList();

  return <div className="agent-md">{blocks}</div>;
}

export function AgentOutputPanel({
  title,
  output,
  model,
  provider,
  latencyMs,
}: {
  title?: string;
  output: string;
  model?: string | null;
  provider?: string | null;
  latencyMs?: number | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-signal/25 bg-gradient-to-br from-signal/10 via-black/40 to-arc/10 shadow-[0_0_40px_rgba(61,255,242,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div>
          <p className="font-display text-sm font-semibold text-signal">
            {title ?? "Agent intelligence"}
          </p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {[provider, model, latencyMs != null ? `${latencyMs}ms` : null]
              .filter(Boolean)
              .join(" · ") || "output"}
          </p>
        </div>
        <span className="rounded-full border border-signal/30 bg-signal/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-signal">
          AI
        </span>
      </div>
      <div className="max-h-[420px] overflow-y-auto px-4 py-3">
        <AgentMarkdown content={output} />
      </div>
    </div>
  );
}
