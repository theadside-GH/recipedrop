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

export async function proxy(request: NextRequest) {
  if (!features.authEnabled) return NextResponse.next({ request });
  const { pathname, search } = request.nextUrl;

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

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathWithSearch(pathname, search));
    return NextResponse.redirect(loginUrl);
  }

  // Invite list (INVITE_EMAILS): signed-in strangers can still browse public
  // pages, but the app itself — and its metered AI — stays friends-only.
  if (user && isProtectedPath(pathname) && isUninvited(user.email)) {
    return NextResponse.redirect(new URL("/not-invited", request.url));
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|icon-maskable-512.png|manifest.webmanifest|robots.txt|sw.js).*)",
  ],
};
