"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";

export type TeamActionState = {
  error?: string;
  ok?: boolean;
  inviteUrl?: string;
} | null;

async function requireOwner() {
  const session = await getSessionProfile();
  if (!session?.org) throw new Error("Not authenticated");
  if (!hasProductAccess(session.org.plan_status)) {
    throw new Error("Upgrade required");
  }
  if (session.profile.role !== "owner") {
    throw new Error("Only owners can manage the team");
  }
  return session;
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "member"]).default("member"),
});

export async function createInvite(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  try {
    const session = await requireOwner();
    const parsed = inviteSchema.safeParse({
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      role: String(formData.get("role") ?? "member"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const supabase = await createClient();
    const { data: pending } = await supabase
      .from("invites")
      .select("id")
      .eq("org_id", session.org!.id)
      .eq("email", parsed.data.email)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (pending) {
      return { error: "An active invite already exists for that email" };
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("invites").insert({
      org_id: session.org!.id,
      email: parsed.data.email,
      role: parsed.data.role,
      token,
      invited_by: session.profile.id,
      expires_at: expiresAt,
    });

    if (error) return { error: error.message };

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";

    revalidatePath("/dashboard/team");
    return { ok: true, inviteUrl: `${origin}/signup?invite=${token}` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create invite",
    };
  }
}

export async function revokeInvite(inviteId: string) {
  const session = await requireOwner();
  const supabase = await createClient();
  await supabase
    .from("invites")
    .delete()
    .eq("id", inviteId)
    .eq("org_id", session.org!.id);
  revalidatePath("/dashboard/team");
}

export async function removeMember(profileId: string) {
  const session = await requireOwner();
  if (profileId === session.profile.id) {
    throw new Error("You cannot remove yourself");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", profileId)
    .eq("org_id", session.org!.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/team");
}
