import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in — IonexFlow" };

export default function LoginPage() {
  return (
    <AuthCard title="Welcome back" description="Sign in to your IonexFlow workspace">
      <LoginForm />
    </AuthCard>
  );
}
