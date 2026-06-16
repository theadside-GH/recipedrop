import { env, features } from "@/lib/env";

/**
 * Resolve the owner email for the current request. In local mode (no Supabase
 * configured) this is the configured OWNER_EMAIL. When auth is enabled, the
 * Supabase session email is used (see src/lib/supabase). Gating to a single
 * known email keeps this a personal, single-user app.
 */
export async function getOwnerEmail(): Promise<string> {
  return (await getCurrentUserProfileSeed()).email;
}

export interface CurrentUserProfileSeed {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export async function getCurrentUserProfileSeed(): Promise<CurrentUserProfileSeed> {
  if (!features.authEnabled) {
    return { email: env.ownerEmail, displayName: null, avatarUrl: null };
  }
  // When auth is wired, the middleware guarantees a valid session; we read it
  // here. Kept lazy so local mode has zero Supabase dependency.
  try {
    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = await getServerSupabase();
    const { data } = await supabase.auth.getUser();
    const metadata = data.user?.user_metadata ?? {};
    return {
      email: data.user?.email ?? env.ownerEmail,
      displayName:
        typeof metadata.full_name === "string"
          ? metadata.full_name
          : typeof metadata.name === "string"
            ? metadata.name
            : null,
      avatarUrl:
        typeof metadata.avatar_url === "string"
          ? metadata.avatar_url
          : typeof metadata.picture === "string"
            ? metadata.picture
            : null,
    };
  } catch {
    return { email: env.ownerEmail, displayName: null, avatarUrl: null };
  }
}
