import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/** Server-side Supabase client bound to the request cookies. Only used when
 *  auth is configured (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY present). */
export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component without a mutable cookie store —
          // safe to ignore; the middleware refreshes the session.
        }
      },
    },
  });
}
