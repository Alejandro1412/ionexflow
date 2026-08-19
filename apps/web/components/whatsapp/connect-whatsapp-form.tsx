"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  connectWhatsApp,
  type WhatsAppActionState,
} from "@/actions/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Connecting…" : "Connect WhatsApp"}
    </Button>
  );
}

export function ConnectWhatsAppForm({
  workflows,
}: {
  workflows: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useFormState(
    connectWhatsApp,
    null as WhatsAppActionState | null
  );

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col gap-1">
        <Label>Display name</Label>
        <Input name="displayName" defaultValue="WhatsApp Business" />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Phone Number ID (Meta)</Label>
        <Input name="phoneNumberId" required placeholder="1234567890" />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Permanent Access Token</Label>
        <Input name="accessToken" type="password" required autoComplete="off" />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Webhook verify token (optional — auto if empty)</Label>
        <Input name="verifyToken" placeholder="ionex-verify-…" />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Default workflow</Label>
        <select
          name="workflowId"
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
        <p className="text-sm text-signal">WhatsApp connected.</p>
      ) : null}
      <Submit />
    </form>
  );
}
