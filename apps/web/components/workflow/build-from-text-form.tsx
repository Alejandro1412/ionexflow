"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  createWorkflowFromDescription,
  type WorkflowActionState,
} from "@/actions/workflows";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Generando…" : "Armar workflow con IA"}
    </Button>
  );
}

export function BuildFromTextForm() {
  const [state, action] = useFormState(
    createWorkflowFromDescription,
    null as WorkflowActionState
  );

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="wf-desc">Describe el proceso en español</Label>
        <textarea
          id="wf-desc"
          name="description"
          required
          minLength={12}
          className="min-h-[120px] rounded-md border border-white/10 bg-black/30 p-3 text-sm"
          placeholder='Ej: Cuando llegue un WhatsApp de un cliente enojado, responde con empatía usando nuestras políticas, avísale a soporte por Slack y pide aprobación humana antes de enviar.'
        />
      </div>
      <p className="text-xs text-muted-foreground">
        La IA crea un borrador <strong>inactivo</strong> para que lo revises,
        uses Test run y luego lo actives. No se publica solo.
      </p>
      {state?.error ? (
        <p className="text-sm text-amber-200">{state.error}</p>
      ) : null}
      <Submit />
    </form>
  );
}
