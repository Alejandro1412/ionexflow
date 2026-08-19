"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  upsertKnowledgeDocument,
  type KnowledgeActionState,
} from "@/actions/knowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save document"}
    </Button>
  );
}

export function KnowledgeForm() {
  const [state, action] = useFormState(
    upsertKnowledgeDocument,
    null as KnowledgeActionState | null
  );

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col gap-1">
        <Label>Title</Label>
        <Input name="title" required placeholder="Política de reembolsos" />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Tags (optional)</Label>
        <Input name="tags" placeholder="soporte, legal" />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Content</Label>
        <textarea
          name="content"
          required
          className="min-h-[180px] rounded-md border border-white/10 bg-black/30 p-3 text-sm"
          placeholder="Pega políticas, FAQs, catálogo, guiones…"
        />
      </div>
      {state?.error ? (
        <p className="text-sm text-amber-200">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-signal">Document saved.</p>
      ) : null}
      <Submit />
    </form>
  );
}
