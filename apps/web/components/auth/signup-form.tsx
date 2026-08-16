"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { signUp, type AuthActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";
import { GoogleButton } from "@/components/auth/google-button";

export function SignupForm() {
  const [state, formAction] = useFormState<AuthActionState, FormData>(
    signUp,
    null
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" placeholder="Ada Lovelace" required autoComplete="name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="orgName">Organization name</Label>
          <Input id="orgName" name="orgName" placeholder="Acme Inc." required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" placeholder="you@company.com" required autoComplete="email" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </div>

        {state?.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}

        <SubmitButton pendingText="Creating your workspace...">
          Create account
        </SubmitButton>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <GoogleButton />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
