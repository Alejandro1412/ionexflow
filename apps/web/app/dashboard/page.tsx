import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, org_id, organizations(name, plan_status)")
    .eq("id", user!.id)
    .single();

  const org = (profile as any)?.organizations;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight glow-text">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="mt-2 text-muted-foreground">
          This is a Phase 1 placeholder. The workflow canvas ships in Phase 3.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            Row Level Security scopes every query below to this org
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{org?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plan status</span>
            <span className="font-medium capitalize">
              {org?.plan_status ?? "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your role</span>
            <span className="font-medium capitalize">{profile?.role}</span>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Phase 2 will paywall this page when <code>plan_status</code> isn&apos;t
        <code>active</code> or <code>trial</code>.
      </p>
    </div>
  );
}
