"use client";

import { useActionState } from "react";
import { upsertVoiceConnection, type VoiceActionState } from "@/actions/voice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: VoiceActionState = {};

export function ConnectVoiceForm({
  workflows,
}: {
  workflows: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(upsertVoiceConnection, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label>Display name</Label>
        <Input name="display_name" defaultValue="Voice inbound" />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Default workflow</Label>
        <select
          name="default_workflow_id"
          required
          className="rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm"
          defaultValue=""
        >
          <option value="">— select —</option>
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
      {state?.error ? (
        <p className="text-sm text-amber-200">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-signal">Voice inbound ready.</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Enable voice inbound"}
      </Button>
    </form>
  );
}
