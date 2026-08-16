// Shared-auth Supabase client for the mobile companion app.
//
// Uses the SAME Supabase project (and therefore the SAME JWTs, RLS
// policies, and `profiles`/`organizations` tables) as apps/web. A user who
// logs in on web and mobile is the same auth.users row either way.
//
// Full sign-in screens + Realtime approvals inbox are built in Phase 5;
// this client is scaffolded now so the monorepo wiring exists from day one.
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
