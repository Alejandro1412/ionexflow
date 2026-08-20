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
      {pending ? "Guardando…" : "Guardar en el cerebro de la empresa"}
    </Button>
  );
}

export function KnowledgeForm() {
  const [state, action] = useFormState(
    upsertKnowledgeDocument,
    null as KnowledgeActionState | null
  );

  return (
    <form action={action} className="space-y-3" encType="multipart/form-data">
      <div className="flex flex-col gap-1">
        <Label>Título</Label>
        <Input
          name="title"
          placeholder="Política de reembolsos / Catálogo Q1…"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>Tipo</Label>
          <select
            name="doc_kind"
            defaultValue="policy"
            className="rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm"
          >
            <option value="policy">Política interna</option>
            <option value="faq">FAQ</option>
            <option value="catalog">Catálogo / precios</option>
            <option value="contract">Contrato / clausulas</option>
            <option value="playbook">Playbook operativo</option>
            <option value="customer">Notas de cliente</option>
            <option value="general">General</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Tags (opcional)</Label>
          <Input name="tags" placeholder="soporte, legal, ventas" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label>Subir archivo (.txt, .md, .csv, .pdf)</Label>
        <Input name="file" type="file" accept=".txt,.md,.csv,.json,.pdf,text/*" />
      </div>
      <div className="flex flex-col gap-1">
        <Label>O pega el contenido</Label>
        <textarea
          name="content"
          className="min-h-[180px] rounded-md border border-white/10 bg-black/30 p-3 text-sm"
          placeholder="Pega políticas, FAQs, catálogo, contratos, guiones…"
        />
      </div>
      {state?.error ? (
        <p className="text-sm text-amber-200">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-signal">
          Guardado e indexado. Los agentes Agent lo usarán automáticamente.
        </p>
      ) : null}
      <Submit />
    </form>
  );
}
