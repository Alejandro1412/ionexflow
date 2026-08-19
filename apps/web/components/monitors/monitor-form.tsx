"use client";

import { useActionState } from "react";
import { upsertMonitor, type MonitorActionState } from "@/actions/monitors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: MonitorActionState = {};

export function MonitorForm({
  workflows,
}: {
  workflows: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(upsertMonitor, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label>Name</Label>
        <Input name="name" required placeholder="Ventas caen 20%" />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Description</Label>
        <Input name="description" placeholder="Opcional" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>Kind</Label>
          <select
            name="kind"
            className="rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm"
            defaultValue="manual_metric"
          >
            <option value="manual_metric">Manual metric</option>
            <option value="failed_executions">Failed executions (window)</option>
            <option value="rejected_approvals">Rejected approvals (window)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Operator</Label>
          <select
            name="operator"
            className="rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm"
            defaultValue="gte"
          >
            <option value="gte">≥</option>
            <option value="gt">&gt;</option>
            <option value="lte">≤</option>
            <option value="lt">&lt;</option>
            <option value="eq">=</option>
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label>Threshold</Label>
          <Input name="threshold" type="number" step="any" defaultValue={1} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Metric value (manual)</Label>
          <Input name="metric_value" type="number" step="any" defaultValue={0} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Window hours</Label>
          <Input name="window_hours" type="number" defaultValue={168} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>Check every (minutes)</Label>
          <Input name="check_every_minutes" type="number" defaultValue={60} min={5} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Workflow to run</Label>
          <select
            name="workflow_id"
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
      </div>
      <div className="flex flex-col gap-1">
        <Label>Trigger message</Label>
        <Input
          name="notify_message"
          placeholder="Si se dispara, este texto entra al workflow"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked value="on" />
        Enabled
      </label>
      {state?.error ? (
        <p className="text-sm text-amber-200">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-signal">Monitor saved.</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create monitor"}
      </Button>
    </form>
  );
}
