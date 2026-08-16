import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Must be created fresh per-request (it reads request cookies).
 *
 * Server Components cannot write cookies (Next.js throws), so the
 * try/catch below is expected and safe: an active middleware session
 * refresh already handles writing back refreshed tokens on the response.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — ignore, middleware refreshes
            // the session cookie on every request instead.
          }
        },
      },
    }
  );
}

/**
 * Service-role client for privileged server-only operations (Stripe
 * webhooks in Phase 2, admin scripts). NEVER import this from anything
 * that ships to the client, and never call it from user-triggered request
 * paths without an explicit authorization check — it bypasses Row Level
 * Security entirely.
 */
export function createServiceRoleClient() {
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
