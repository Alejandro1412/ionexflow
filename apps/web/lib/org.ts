import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type OrgRow = Database["public"]["Tables"]["organizations"]["Row"];

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(*)")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const org = (profile as ProfileRow & { organizations: OrgRow | null }).organizations;
  return {
    user,
    profile: profile as ProfileRow,
    org,
  };
}
