import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { pathWithSearch } from "@/lib/auth-redirect";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const OWNER = process.env.OWNER_EMAIL ?? "";
const AUTH_ENABLED = SUPABASE_URL.length > 0 && SUPABASE_ANON.length > 0;

const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/api/health",
  "/manifest.webmanifest",
  "/sw.js",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
];

export async function proxy(request: NextRequest) {
  // Local mode (no Supabase configured) — no auth, pass everything through.
  if (!AUTH_ENABLED) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Signed in but not the owner → block.
  if (user && OWNER && user.email !== OWNER) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("denied", "1");
    await supabase.auth.signOut();
    return NextResponse.redirect(url);
  }

  // Not signed in and not on a public path → send to login.
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathWithSearch(path, request.nextUrl.search));
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on app routes, but leave static assets and PWA install files public.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|icon-maskable-512.png|manifest.webmanifest|sw.js).*)",
  ],
};
