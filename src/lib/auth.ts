import { env, features } from "@/lib/env";

/**
 * Resolve the owner email for the current request. In local mode (no Supabase
 * configured) this is the configured OWNER_EMAIL. When auth is enabled, the
 * Supabase session email is used (see src/lib/supabase). Gating to a single
 * known email keeps this a personal, single-user app.
 */
export async function getOwnerEmail(): Promise<string> {
  if (!features.authEnabled) return env.ownerEmail;
  // When auth is wired, the middleware guarantees a valid session; we read it
  // here. Kept lazy so local mode has zero Supabase dependency.
  try {
    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = await getServerSupabase();
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? env.ownerEmail;
  } catch {
    return env.ownerEmail;
  }
}
