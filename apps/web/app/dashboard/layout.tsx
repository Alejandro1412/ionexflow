import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/actions/auth";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { DashboardNav } from "@/components/dashboard/nav";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { IonexAssistantWidget } from "@/components/assistant/ionex-assistant-widget";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionProfile();
  if (!session?.user) redirect("/login");

  const locked = session.org ? !hasProductAccess(session.org.plan_status) : false;

  const supabase = await createClient();
  const { data: notificationRows } = await supabase
    .from("notifications")
    .select("id, title, body, href, read_at, created_at, type")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(12);
  const { count: unreadExact } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .is("read_at", null);
  const notifications = notificationRows ?? [];
  const unreadCount = unreadExact ?? notifications.filter((n) => !n.read_at).length;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative z-[100] border-b border-white/10 bg-black/25 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-4">
          <Link
            href="/dashboard"
            className="font-display text-lg font-bold tracking-tight glow-text"
          >
            IonexFlow
          </Link>
          <div className="flex items-center gap-3">
            {session.org ? (
              <span className="hidden text-xs uppercase tracking-wider text-muted-foreground sm:inline">
                {session.org.name} · {session.org.plan_status}
              </span>
            ) : null}
            <NotificationBell
              initialItems={notifications}
              unreadCount={unreadCount}
            />
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
        <DashboardNav />
      </header>

      {locked ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-3 text-sm text-amber-100">
          Your plan is{" "}
          <strong>{session.org?.plan_status}</strong>. Product features are locked —{" "}
          <Link href="/dashboard/billing" className="underline">
            fix billing
          </Link>
          .
        </div>
      ) : null}

      <main className="flex-1 p-6">{children}</main>
      {!locked ? (
        <IonexAssistantWidget
          userFirstName={
            session.profile.full_name?.trim().split(/\s+/)[0] ||
            session.user.email?.split("@")[0] ||
            "amigo"
          }
          orgName={session.org?.name}
        />
      ) : null}
    </div>
  );
}
