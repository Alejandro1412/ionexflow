"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";

export async function markNotificationRead(notificationId: string) {
  const session = await getSessionProfile();
  if (!session?.user) throw new Error("Not authenticated");
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", session.user.id)
    .is("read_at", null);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}

export async function markAllNotificationsRead() {
  const session = await getSessionProfile();
  if (!session?.user) throw new Error("Not authenticated");
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", session.user.id)
    .is("read_at", null);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}
