import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Auth is temporarily disabled for private testing, so every app route passes through.
  return NextResponse.next({ request });
}

export const config = {
  // Run on app routes, but leave static assets and PWA install files public.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|icon-maskable-512.png|manifest.webmanifest|sw.js).*)",
  ],
};
