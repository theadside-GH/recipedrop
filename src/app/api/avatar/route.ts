import { getCurrentUserProfileSeed, getViewerEmail } from "@/lib/auth";
import { getOrCreateProfile } from "@/lib/repo/profiles";

export const dynamic = "force-dynamic";

/**
 * The signed-in viewer's profile picture, for the nav avatar. Serving it from
 * a route keeps data-URL avatars (stored inline in the profile row) out of
 * every page's HTML — the browser fetches once and caches instead.
 */
export async function GET() {
  const viewer = await getViewerEmail();
  if (!viewer) return new Response(null, { status: 404 });

  // Same seed path as the profile page, so a Google sign-in's photo shows in
  // the nav even before the user ever opens /profile.
  const seed = await getCurrentUserProfileSeed();
  const profile = await getOrCreateProfile(seed.email, {
    displayName: seed.displayName,
    avatarUrl: seed.avatarUrl,
  });
  const avatar = profile.avatarUrl;
  if (!avatar) return new Response(null, { status: 404 });

  if (avatar.startsWith("data:")) {
    const match = avatar.match(/^data:([^;,]+);base64,(.+)$/);
    if (!match) return new Response(null, { status: 404 });
    return new Response(Buffer.from(match[2], "base64"), {
      headers: {
        "content-type": match[1],
        "cache-control": "private, max-age=300",
      },
    });
  }

  // Remote avatar (e.g. Google photo) — let the browser load it directly.
  return Response.redirect(avatar, 302);
}
