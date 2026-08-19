"use client";

import { useFormState } from "react-dom";
import { createInvite, type TeamActionState } from "@/actions/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

export function InviteMemberForm() {
  const [state, action] = useFormState<TeamActionState, FormData>(
    createInvite,
    null
  );

  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="teammate@company.com"
        />
      </div>
      <div className="w-full space-y-2 sm:w-40">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          defaultValue="member"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="member">Member</option>
          <option value="owner">Owner</option>
        </select>
      </div>
      <SubmitButton pendingText="Inviting…">Send invite</SubmitButton>
      {state?.error ? (
        <p className="w-full text-sm text-destructive sm:basis-full" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.inviteUrl ? (
        <div className="w-full space-y-2 sm:basis-full">
          <p className="text-sm text-signal">Invite created. Share this link:</p>
          <Input readOnly value={state.inviteUrl} onFocus={(e) => e.target.select()} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(state.inviteUrl!)}
          >
            Copy link
          </Button>
        </div>
      ) : null}
    </form>
  );
}
