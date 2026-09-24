"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeRedirectPath } from "@/lib/auth-redirect";
import { getBrowserSupabase } from "@/lib/supabase/client";

// Email magic links are switched off: the link only signs in the browser it
// opens in, and on iPhone that's Safari or Gmail's in-app browser — never the
// Home Screen app — so it "didn't work". Google is the only sign-in until the
// Supabase email template carries a typeable code ({{ .Token }}); then add a
// code box that calls supabase.auth.verifyOtp({ email, token, type: "email" }).
export function LoginForm({
  authEnabled,
  inviteOnly = false,
}: {
  authEnabled: boolean;
  inviteOnly?: boolean;
}) {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const denied = params.get("denied");
  const next = safeRedirectPath(params.get("next"));

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    try {
      const supabase = getBrowserSupabase();
      const confirmUrl = new URL("/auth/confirm", window.location.origin);
      if (next !== "/") confirmUrl.searchParams.set("next", next);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: confirmUrl.toString() },
      });
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start sign-in.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-full.webp" alt="DishCovered — From REEL to REAL" className="w-64 max-w-full" />
      <h1 className="mt-5 text-2xl font-bold">Welcome to DishCovered</h1>
      <p className="mt-1 font-display text-lg text-brand">What did you Dishcover this week?</p>
      <p className="mt-1 text-muted">
        Save recipes from TikTok, Instagram, YouTube, websites, photos, or pasted text,
        then get clean instructions and shopping lists.
      </p>
      <p className="mt-1 text-muted">Sign in with your Google account — no password needed.</p>
      {inviteOnly && (
        <p className="mt-2 text-sm text-muted">
          DishCovered is <strong className="font-medium text-foreground">invite-only</strong> right
          now — anyone can browse public dishcoveries, but saving and importing needs an invite
          from a current dishcoverer.
        </p>
      )}

      {!authEnabled ? (
        <p className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          Auth isn&apos;t configured. The app is running in local single-user mode — just
          go to the home page.
        </p>
      ) : (
        <div className="mt-6 w-full space-y-3">
          {denied && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              That sign-in didn&apos;t go through — it may have expired or been opened in a
              different browser. Try again below.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="button" onClick={signInWithGoogle} disabled={busy} className="w-full" size="lg">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-white text-xs font-bold text-stone-900">
                G
              </span>
            )}
            Continue with Google
          </Button>
        </div>
      )}
    </div>
  );
}
