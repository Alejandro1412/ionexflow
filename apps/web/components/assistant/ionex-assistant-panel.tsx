"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AgentMarkdown } from "@/components/ai/agent-output";
import { ASSISTANT_STARTERS } from "@/lib/ai/assistant-knowledge";
import { Button } from "@/components/ui/button";

type Msg = { id: string; role: "user" | "assistant"; content: string };

function buildWelcome(firstName: string, orgName?: string): Msg {
  const name = firstName || "hola";
  return {
    id: "welcome",
    role: "assistant",
    content: [
      `¡Hola, **${name}**! Soy Ionex.`,
      ``,
      `Qué gusto tenerte por aquí${orgName ? ` en **${orgName}**` : ""}.`,
      `Puedo explicarte IonexFlow, guiarte paso a paso o simplemente charlar un rato.`,
      ``,
      `¿Cómo estás hoy? ¿En qué te puedo acompañar?`,
    ].join("\n"),
  };
}

export function IonexAssistantPanel({
  variant = "widget",
  onClose,
  userFirstName = "amigo",
  orgName,
}: {
  variant?: "widget" | "page";
  onClose?: () => void;
  userFirstName?: string;
  orgName?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>(() => [
    buildWelcome(userFirstName, orgName),
  ]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const canSend = useMemo(
    () => input.trim().length > 0 && !pending,
    [input, pending]
  );

  const placeholder = `Escríbele a Ionex, ${userFirstName}…`;

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;

    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: next
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Assistant error");
        const reply = (json.content as string) ?? "";
        const notice = typeof json.notice === "string" ? json.notice : null;
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: notice ? `${reply}\n\n> ${notice}` : reply,
          },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No pude responder");
      }
    });
  }

  return (
    <div
      className={`flex flex-col overflow-hidden border border-signal/25 bg-[#070b14]/90 shadow-[0_0_60px_rgba(61,255,242,0.12)] backdrop-blur-xl ${
        variant === "widget"
          ? "h-[min(640px,78vh)] w-[min(420px,calc(100vw-1.5rem))] rounded-2xl"
          : "min-h-[70vh] rounded-2xl"
      }`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-signal/15 via-transparent to-arc/10 px-4 py-3">
        <div>
          <p className="font-display text-sm font-bold tracking-tight text-signal">
            Ionex Assistant
          </p>
          <p className="text-[11px] text-muted-foreground">
            Conversando con {userFirstName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {variant === "widget" ? (
            <Link
              href="/dashboard/assistant"
              className="text-[11px] text-muted-foreground hover:text-signal"
            >
              Expand
            </Link>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-white/10 hover:text-foreground"
              aria-label="Close assistant"
            >
              ✕
            </button>
          ) : null}
        </div>
      </header>

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[95%] rounded-xl px-3 py-2 text-sm ${
              msg.role === "user"
                ? "ml-auto bg-signal/20 text-foreground"
                : "mr-auto border border-white/10 bg-black/40"
            }`}
          >
            {msg.role === "assistant" ? (
              <AgentMarkdown content={msg.content} />
            ) : (
              <p className="leading-relaxed">{msg.content}</p>
            )}
          </div>
        ))}
        {pending ? (
          <div className="mr-auto rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-muted-foreground">
            Ionex está escribiendo…
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-white/10 px-3 py-3">
        <div className="flex flex-wrap gap-1.5">
          {ASSISTANT_STARTERS.map((starter) => (
            <button
              key={starter}
              type="button"
              disabled={pending}
              onClick={() => send(starter)}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-signal/40 hover:text-signal disabled:opacity-50"
            >
              {starter}
            </button>
          ))}
        </div>
        {error ? <p className="text-xs text-amber-200">{error}</p> : null}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm outline-none ring-signal focus:ring-1"
            disabled={pending}
          />
          <Button type="submit" size="sm" disabled={!canSend}>
            Enviar
          </Button>
        </form>
      </div>
    </div>
  );
}
