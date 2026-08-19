"use client";

import { useState, useTransition } from "react";
import { resolveApproval } from "@/actions/executions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function ApprovalActions({
  approvalId,
  initialOutput,
}: {
  approvalId: string;
  initialOutput?: string | null;
}) {
  const [edited, setEdited] = useState(initialOutput ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`edit-${approvalId}`}>Edit before approve (optional)</Label>
        <textarea
          id={`edit-${approvalId}`}
          className="min-h-[120px] w-full rounded-md border border-white/10 bg-black/30 p-2 text-sm"
          value={edited}
          onChange={(e) => setEdited(e.target.value)}
          placeholder="Adjust tone or wording, then Approve with edits"
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await resolveApproval(approvalId, "approved", edited);
            })
          }
        >
          {pending ? "…" : "Approve"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await resolveApproval(approvalId, "rejected");
            })
          }
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
