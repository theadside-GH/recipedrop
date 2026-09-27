import { NextResponse, type NextRequest } from "next/server";

/**
 * Manifest share_target (POST) when the service worker isn't in control yet —
 * normally public/sw.js answers this before it reaches the server. Links and
 * text go on to /share; shared photos can't survive a redirect, so send them
 * to the photo tab with a note to pick the photo there.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const params = new URLSearchParams();
  for (const key of ["title", "text", "url"]) {
    const value = form?.get(key);
    if (typeof value === "string" && value.trim()) params.set(key, value);
  }
  const hasPhoto = form?.getAll("photos").some((file) => typeof file !== "string" && file.size > 0);
  const target = hasPhoto && !params.size ? "/import?shared=photos-missed" : `/share?${params}`;
  return NextResponse.redirect(new URL(target, request.url), 303);
}
