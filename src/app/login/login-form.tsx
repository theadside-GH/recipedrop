"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeRedirectPath } from "@/lib/auth-redirect";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function LoginForm({ authEnabled }: { authEnabled: boolean }) {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const denied = params.get("denied");
  const next = safeRedirectPath(params.get("next"));

  async function sendLink() {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getBrowserSupabase();
      const confirmUrl = new URL("/auth/confirm", window.location.origin);
      if (next !== "/") confirmUrl.searchParams.set("next", next);
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: confirmUrl.toString() },
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the magic link.");
    } finally {
      setBusy(false);
    }
  }

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
      <p className="mt-1 text-muted">Sign in with a magic link — no password needed.</p>

      {!authEnabled ? (
        <p className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          Auth isn&apos;t configured. The app is running in local single-user mode — just
          go to the home page.
        </p>
      ) : sent ? (
        <p className="mt-6 rounded-xl border border-fresh/30 bg-fresh-soft p-4 text-sm text-fresh">
          Check your email — we sent a sign-in link to <strong>{email}</strong>.
        </p>
      ) : (
        <div className="mt-6 w-full space-y-3">
          {denied && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              That sign-in link didn&apos;t work — it may have expired or already been used.
              Enter your email below and we&apos;ll send you a fresh one.
            </p>
          )}
          <div className="grid gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={signInWithGoogle}
              disabled={busy}
              className="w-full"
              size="lg"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-white text-xs font-bold text-foreground">
                G
              </span>
              Continue with Google
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendLink()}
              placeholder="you@example.com"
              className="pl-11"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={sendLink} disabled={busy} className="w-full" size="lg">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send magic link
          </Button>
        </div>
      )}
    </div>
  );
}
