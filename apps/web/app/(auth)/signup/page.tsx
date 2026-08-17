import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: true },
};

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your workspace"
      description="Sets up your organization and owner account"
    >
      <SignupForm />
    </AuthCard>
  );
}
