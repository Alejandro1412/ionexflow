"use client";

import { useFormState, useFormStatus } from "react-dom";
import { runAiLab, type AiLabState } from "@/actions/ai-lab";
import { AGENT_MODE_META, type AgentMode } from "@/lib/ai/modes";
import { AgentOutputPanel } from "@/components/ai/agent-output";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Thinking…" : "Run lab agent"}
    </Button>
  );
}

export function AiLabForm() {
  const [state, action] = useFormState(runAiLab, null as AiLabState);
  const modes = Object.keys(AGENT_MODE_META) as AgentMode[];

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="mode">Playbook mode</Label>
          <select
            id="mode"
            name="mode"
            defaultValue="ops"
            className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
          >
            {modes.map((mode) => (
              <option key={mode} value={mode}>
                {AGENT_MODE_META[mode].label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="prompt">Task / process to automate</Label>
        <textarea
          id="prompt"
          name="prompt"
          required
          rows={5}
          placeholder="Ej: Convierte estas notas de standup en un playbook con owners y DoD…"
          className="rounded-md border border-white/10 bg-black/40 p-3 text-sm"
        />
      </div>
      <SubmitButton />
      {state?.error ? <p className="text-sm text-amber-200">{state.error}</p> : null}
      {state?.output ? (
        <AgentOutputPanel
          title="Lab output"
          output={state.output}
          model={state.model}
          provider={state.provider}
          latencyMs={state.latencyMs}
        />
      ) : null}
    </form>
  );
}
