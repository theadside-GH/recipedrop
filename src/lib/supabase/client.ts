"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client for the login flow. Only used when auth is enabled. */
export function getBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
}
