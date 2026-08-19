import { redirect } from "next/navigation";
import { revokeInvite, removeMember } from "@/actions/team";
import { InviteMemberForm } from "@/components/team/invite-member-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";

export default async function TeamPage() {
  const session = await getSessionProfile();
  if (!session?.org) redirect("/login");
  if (!hasProductAccess(session.org.plan_status)) {
    redirect("/dashboard/billing?paywall=1");
  }

  const isOwner = session.profile.role === "owner";
  const supabase = await createClient();

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .eq("org_id", session.org.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("invites")
      .select("id, email, role, expires_at, accepted_at, created_at, token")
      .eq("org_id", session.org.id)
      .order("created_at", { ascending: false }),
  ]);

  const pending = (invites ?? []).filter(
    (i) => !i.accepted_at && new Date(i.expires_at) > new Date()
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <p className="font-display text-sm font-semibold uppercase tracking-[0.28em] text-signal">
          Team
        </p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight glow-text">
          {session.org.name}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Invite operators and approvers into the same workspace. Owners manage
          billing and integrations; members run and approve workflows.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Your role: <span className="text-foreground">{session.profile.role}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(members ?? []).map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-3 last:border-0"
            >
              <div>
                <p className="font-medium">{m.full_name || "Unnamed"}</p>
                <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
              </div>
              {isOwner && m.id !== session.profile.id ? (
                <form
                  action={async () => {
                    "use server";
                    await removeMember(m.id);
                  }}
                >
                  <Button type="submit" variant="outline" size="sm">
                    Remove
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {isOwner ? (
        <Card className="border-signal/30">
          <CardHeader>
            <CardTitle>Invite teammate</CardTitle>
            <CardDescription>
              They must sign up with the invited email. Link expires in 7 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <InviteMemberForm />
            {pending.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Pending invites</p>
                {pending.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm">{inv.email}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <form
                      action={async () => {
                        "use server";
                        await revokeInvite(inv.id);
                      }}
                    >
                      <Button type="submit" variant="ghost" size="sm">
                        Revoke
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only owners can invite or remove teammates.
        </p>
      )}
    </div>
  );
}
