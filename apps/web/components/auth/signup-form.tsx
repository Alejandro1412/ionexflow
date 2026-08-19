"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { signUp, type AuthActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";
import { GoogleButton, isGoogleAuthEnabled } from "@/components/auth/google-button";

export function SignupForm({
  inviteToken,
  inviteEmail,
  orgName,
}: {
  inviteToken?: string;
  inviteEmail?: string;
  orgName?: string;
}) {
  const [state, formAction] = useFormState<AuthActionState, FormData>(
    signUp,
    null
  );
  const googleEnabled = isGoogleAuthEnabled() && !inviteToken;

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        {inviteToken ? (
          <input type="hidden" name="inviteToken" value={inviteToken} />
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            name="fullName"
            placeholder="Ada Lovelace"
            required
            autoComplete="name"
          />
        </div>
        {!inviteToken ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="orgName">Organization name</Label>
            <Input
              id="orgName"
              name="orgName"
              placeholder="Acme Inc."
              required
            />
          </div>
        ) : (
          <p className="rounded-md border border-signal/30 bg-signal/5 px-3 py-2 text-sm text-muted-foreground">
            Joining <span className="text-foreground">{orgName ?? "workspace"}</span>
            {inviteEmail ? (
              <>
                {" "}
                as <span className="text-foreground">{inviteEmail}</span>
              </>
            ) : null}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            required
            autoComplete="email"
            defaultValue={inviteEmail ?? ""}
            readOnly={Boolean(inviteEmail)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {state?.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}

        <SubmitButton pendingText="Creating your workspace...">
          {inviteToken ? "Join workspace" : "Create account"}
        </SubmitButton>
      </form>

      {googleEnabled ? (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>
          <GoogleButton />
        </>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
