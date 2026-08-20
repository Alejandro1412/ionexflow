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
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Generando diagrama…" : "Armar workflow con IA"}
    </Button>
  );
}

const EXAMPLE =
  "Cuando llegue un correo de un cliente enojado, que se le responda con empatía y se le avise a mi jefe de soporte";

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
          className="min-h-[140px] rounded-md border border-white/10 bg-black/30 p-3 text-sm"
          placeholder={`Ej: ${EXAMPLE}`}
          defaultValue=""
        />
      </div>
      <p className="text-xs text-muted-foreground">
        La IA crea un borrador <strong>inactivo</strong>: revisa el canvas,
        haz <strong>Test run</strong>, conecta email/WhatsApp si hace falta, y
        luego actívalo. No se publica solo.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-muted-foreground hover:border-signal/40 hover:text-signal"
          onClick={(e) => {
            const form = (e.target as HTMLElement).closest("form");
            const ta = form?.querySelector(
              "#wf-desc"
            ) as HTMLTextAreaElement | null;
            if (ta) ta.value = EXAMPLE;
          }}
        >
          Usar ejemplo de correo enojado
        </button>
      </div>
      {state?.error ? (
        <p className="text-sm text-amber-200">{state.error}</p>
      ) : null}
      <Submit />
    </form>
  );
}
