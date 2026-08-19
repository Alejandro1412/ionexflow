"use client";

import { useEffect, useState } from "react";
import { IonexAssistantPanel } from "@/components/assistant/ionex-assistant-panel";

export function IonexAssistantWidget({
  userFirstName,
  orgName,
}: {
  userFirstName: string;
  orgName?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div className="pointer-events-auto">
          <IonexAssistantPanel
            variant="widget"
            onClose={() => setOpen(false)}
            userFirstName={userFirstName}
            orgName={orgName}
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto group flex items-center gap-2 rounded-full border border-signal/40 bg-gradient-to-r from-signal to-arc px-4 py-3 font-display text-sm font-bold text-[#05070F] shadow-[0_0_32px_rgba(61,255,242,0.35)] transition hover:scale-[1.02]"
        aria-expanded={open}
        aria-label={open ? "Close Ionex assistant" : "Open Ionex assistant"}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/20 text-xs">
          AI
        </span>
        {open ? "Close" : `Ask Ionex`}
      </button>
    </div>
  );
}
