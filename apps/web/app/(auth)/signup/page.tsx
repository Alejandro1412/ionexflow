import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: true },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: { invite?: string };
}) {
  const token = searchParams?.invite?.trim();
  let inviteEmail: string | undefined;
  let orgName: string | undefined;

  if (token) {
    const admin = createServiceRoleClient();
    const { data: invite } = await admin
      .from("invites")
      .select("email, expires_at, accepted_at, organizations(name)")
      .eq("token", token)
      .maybeSingle();

    if (
      invite &&
      !invite.accepted_at &&
      new Date(invite.expires_at) > new Date()
    ) {
      inviteEmail = invite.email;
      const org = invite.organizations as { name?: string } | null;
      orgName = org?.name;
    }
  }

  return (
    <AuthCard
      title={token && inviteEmail ? "Join your team" : "Create your workspace"}
      description={
        token && inviteEmail
          ? "Accept the invite with the email that received it"
          : "Sets up your organization and owner account"
      }
    >
      <SignupForm
        inviteToken={token && inviteEmail ? token : undefined}
        inviteEmail={inviteEmail}
        orgName={orgName}
      />
    </AuthCard>
  );
}
