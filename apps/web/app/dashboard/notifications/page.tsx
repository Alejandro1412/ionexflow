import Link from "next/link";
import { redirect } from "next/navigation";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { getSessionProfile } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage() {
  const session = await getSessionProfile();
  if (!session?.user) redirect("/login");

  const supabase = await createClient();
  const { data: items } = await supabase
    .from("notifications")
    .select("id, title, body, href, read_at, created_at, type")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Inbox
          </p>
          <h1 className="font-display text-3xl font-bold glow-text">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Approvals and system alerts for {session.org?.name ?? "your org"}.
          </p>
        </div>
        <form action={markAllNotificationsRead}>
          <Button type="submit" variant="outline" size="sm">
            Mark all read
          </Button>
        </form>
      </div>

      <ul className="space-y-2">
        {(items ?? []).length === 0 ? (
          <li className="glass-panel px-5 py-10 text-center text-sm text-muted-foreground">
            No notifications yet. Run a workflow with an Approval node to see one
            appear here.
          </li>
        ) : (
          (items ?? []).map((item) => (
            <li
              key={item.id}
              className={`glass-panel flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between ${
                item.read_at ? "opacity-75" : "ring-1 ring-signal/30"
              }`}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{item.title}</p>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {item.type}
                  </span>
                  {!item.read_at ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-signal">
                      Unread
                    </span>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {item.body}
                </p>
                <p className="text-xs text-muted-foreground/80">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {item.href ? (
                  <Button asChild size="sm">
                    <Link href={item.href} prefetch={false}>
                      Open
                    </Link>
                  </Button>
                ) : null}
                {!item.read_at ? (
                  <form
                    action={async () => {
                      "use server";
                      await markNotificationRead(item.id);
                    }}
                  >
                    <Button type="submit" variant="outline" size="sm">
                      Mark read
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
