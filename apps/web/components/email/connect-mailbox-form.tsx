"use client";

import { useMemo, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  connectMailbox,
  syncMailboxNow,
  type EmailActionState,
} from "@/actions/email";
import { MAIL_PRESETS, type MailPresetKey } from "@/lib/email/presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

export function ConnectMailboxForm({
  workflows,
}: {
  workflows: { id: string; name: string }[];
}) {
  const [preset, setPreset] = useState<MailPresetKey>("gmail");
  const defaults = MAIL_PRESETS[preset];
  const [state, action] = useFormState(connectMailbox, null as EmailActionState | null);

  const initial = useMemo(
    () => ({
      imapHost: defaults.imapHost,
      imapPort: String(defaults.imapPort),
      smtpHost: defaults.smtpHost,
      smtpPort: String(defaults.smtpPort),
      imapSecure: defaults.imapSecure ? "true" : "false",
      smtpSecure: defaults.smtpSecure ? "true" : "false",
    }),
    [defaults]
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="preset" value={preset} />
      <div className="flex flex-wrap gap-2">
        {(Object.keys(MAIL_PRESETS) as MailPresetKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setPreset(key)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              preset === key
                ? "border-signal/50 bg-signal/15 text-signal"
                : "border-white/10 text-muted-foreground hover:border-white/25"
            }`}
          >
            {MAIL_PRESETS[key].label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{defaults.hint}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label>Email address</Label>
          <Input
            name="emailAddress"
            type="email"
            required
            placeholder="soporte@tuempresa.com"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Username</Label>
          <Input name="username" placeholder="Usually same as email" />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Password / App password</Label>
          <Input name="password" type="password" required autoComplete="off" />
        </div>
        <div className="flex flex-col gap-1">
          <Label>IMAP host</Label>
          <Input name="imapHost" required defaultValue={initial.imapHost} key={`imap-${preset}`} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>IMAP port</Label>
          <Input name="imapPort" type="number" required defaultValue={initial.imapPort} key={`iport-${preset}`} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>SMTP host</Label>
          <Input name="smtpHost" required defaultValue={initial.smtpHost} key={`smtp-${preset}`} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>SMTP port</Label>
          <Input name="smtpPort" type="number" required defaultValue={initial.smtpPort} key={`sport-${preset}`} />
        </div>
        <input type="hidden" name="imapSecure" value={initial.imapSecure} />
        <input type="hidden" name="smtpSecure" value={initial.smtpSecure} />
        <div className="flex flex-col gap-1">
          <Label>Default workflow</Label>
          <select
            name="workflowId"
            className="h-10 rounded-md border border-white/10 bg-black/40 px-2 text-sm"
            defaultValue=""
          >
            <option value="">Select…</option>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Redirect sensitive mail to</Label>
          <Input name="forwardTo" placeholder="legal@tuempresa.com" />
        </div>
      </div>

      {state?.error ? (
        <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-md border border-signal/30 bg-signal/10 px-3 py-2 text-sm text-signal">
          Mailbox verified and connected (IMAP + SMTP live).
        </p>
      ) : null}

      <SubmitButton label="Verify & connect mailbox" />
    </form>
  );
}

export function SyncMailboxButton({ connectionId }: { connectionId: string }) {
  const [state, action] = useFormState(syncMailboxNow, null as EmailActionState | null);
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <form
        action={(fd) => {
          startTransition(() => {
            void action(fd);
          });
        }}
      >
        <input type="hidden" name="connectionId" value={connectionId} />
        <SubmitButton label="Sync inbox now" />
      </form>
      {state?.error ? (
        <p className="text-xs text-red-300">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-xs text-signal">
          Synced {state.synced ?? 0} new message(s) into automations.
        </p>
      ) : null}
    </div>
  );
}
