import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, features, isUninvited } from "@/lib/env";
import { pathWithSearch } from "@/lib/auth-redirect";

// Only these routes require a signed-in (and invited) account. Everything
// else — public pages (/discover, /r, /c, /u, /about), public APIs, robots,
// and any mistyped URL — passes through, so typos land on the branded 404
// instead of a confusing sign-in prompt.
const PROTECTED_PREFIXES = [
  "/recipes",
  "/import",
  "/plans",
  "/pantry",
  "/profile",
  "/collections",
  "/share",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Anonymous-by-design API routes: the image proxy and OG images are fetched
// by browsers/crawlers without cookies, health is for uptime checks, and the
// Stripe webhook authenticates via signature, not session. (Session-scoped
// APIs like /api/export and /api/avatar are NOT listed — they stay behind the
// normal auth pass.)
const PUBLIC_API_PREFIXES = ["/api/img", "/api/og-image", "/api/health", "/api/stripe"];

function isPublicApiPath(pathname: string) {
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  // Canonical host. The apex and www both serve the app, but auth cookies are
  // host-only — a login on www is invisible on dishcovered.app and vice versa,
  // which reads as "the app logged me out again". Fold the apex onto www
  // before any auth work so there is exactly one cookie jar.
  const host = request.headers.get("host")?.toLowerCase();
  if (host === "dishcovered.app") {
    const url = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      "https://www.dishcovered.app",
    );
    return NextResponse.redirect(url, 308);
  }

  if (!features.authEnabled) return NextResponse.next({ request });
  const { pathname, search } = request.nextUrl;

  // Public API surfaces never read the session, but every recipe card image
  // routes through /api/img — running a Supabase auth round-trip per image
  // taxed the hottest pages for nothing. Skip straight through.
  if (isPublicApiPath(pathname)) {
    return NextResponse.next({ request });
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/discover", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // getUser() above may have refreshed the session — Supabase rotates the
  // refresh token, so a redirect that drops the Set-Cookie headers strands the
  // browser with a dead token and the next visit is signed out. Every response
  // the proxy returns from here on must carry the refreshed cookies.
  const redirectWithAuthCookies = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  };

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathWithSearch(pathname, search));
    return redirectWithAuthCookies(loginUrl);
  }

  // Invite list (INVITE_EMAILS): signed-in strangers can still browse public
  // pages, but the app itself — and its metered AI — stays friends-only.
  if (user && isProtectedPath(pathname) && isUninvited(user.email)) {
    return redirectWithAuthCookies(new URL("/not-invited", request.url));
  }

  if (user && pathname === "/login") {
    return redirectWithAuthCookies(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|icon-maskable-512.png|manifest.webmanifest|robots.txt|sw.js).*)",
  ],
};
