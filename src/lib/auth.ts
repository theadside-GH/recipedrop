import { env, features } from "@/lib/env";

/**
 * The signed-in user's email, or null for anonymous visitors on public pages.
 * In local mode (no Supabase configured) this is always OWNER_EMAIL.
 */
export async function getViewerEmail(): Promise<string | null> {
  if (!features.authEnabled) return env.ownerEmail;
  try {
    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = await getServerSupabase();
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

/**
 * The signed-in user's email for owner-scoped reads/writes. Throws for
 * anonymous requests (public pages that tolerate anonymous viewers should use
 * getViewerEmail instead) so writes can never fall back to someone else's
 * account.
 */
export async function getOwnerEmail(): Promise<string> {
  const email = await getViewerEmail();
  if (!email) throw new Error("Please sign in to do that.");
  return email;
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
