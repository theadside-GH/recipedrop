"use client";

import { useSyncExternalStore } from "react";
import { Share, Smartphone, Sparkles, X, Zap } from "lucide-react";
import { useLocalSetting } from "@/lib/use-local-setting";

const DISMISS_KEY = "rd-share-onboarding-dismissed";

const noopSubscribe = () => () => {};

/**
 * One-time teach card for the fastest way to save recipes: install the app,
 * then share straight from TikTok/Instagram/YouTube. Hidden once dismissed,
 * and never shown when already running as the installed app.
 */
export function ShareOnboardingCard() {
  const [dismissed, setDismissed] = useLocalSetting(DISMISS_KEY, "");
  // Server snapshot says "installed" so nothing flashes during hydration.
  const installed = useSyncExternalStore(
    noopSubscribe,
    () => window.matchMedia("(display-mode: standalone)").matches,
    () => true,
  );
  // iOS has no Web Share Target: the share sheet will never list DishCovered
  // there, so iPhone users get the copy-the-link flow instead of a dead end.
  const isIos = useSyncExternalStore(
    noopSubscribe,
    () => /iPad|iPhone|iPod/.test(window.navigator.userAgent),
    () => false,
  );

  if (installed || dismissed === "1") return null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-brand/25 bg-gradient-to-br from-brand-soft via-background to-brand-soft p-6 pr-12 sm:p-7">
      <Zap
        aria-hidden
        className="pointer-events-none absolute -bottom-6 -right-4 h-32 w-32 rotate-12 text-brand opacity-[0.08]"
      />
      <button
        type="button"
        onClick={() => setDismissed("1")}
        aria-label="Dismiss"
        className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted transition-colors hover:bg-card hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <p className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-foreground shadow-sm">
        <Zap className="h-3.5 w-3.5" /> The fast way
      </p>
      <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        {isIos ? "Save recipes in seconds" : "Save recipes in two taps"}
      </h2>
      <p className="mt-1 max-w-lg text-sm text-muted">
        See a recipe video? Get it into DishCovered as a clean, step-by-step recipe — no
        typing, no screenshots.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="flex gap-3 rounded-2xl border border-brand/20 bg-card/80 p-4 backdrop-blur">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-foreground shadow-sm">
            1
          </span>
          <div className="text-sm">
            <p className="flex items-center gap-1.5 font-semibold">
              <Smartphone className="h-4 w-4 text-brand" /> Put it on your phone
            </p>
            <p className="mt-1 text-muted">
              {isIos ? (
                <>
                  Open this site in Safari → Share → <strong>Add to Home Screen</strong>.
                </>
              ) : (
                <>
                  Open this site in Chrome → menu → <strong>Install app</strong>.
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-2xl border border-brand/20 bg-card/80 p-4 backdrop-blur">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-foreground shadow-sm">
            2
          </span>
          <div className="text-sm">
            <p className="flex items-center gap-1.5 font-semibold">
              <Share className="h-4 w-4 text-brand" />
              {isIos ? "Copy any recipe video's link" : "Share any recipe video"}
            </p>
            <p className="mt-1 text-muted">
              {isIos ? (
                <>
                  In TikTok, Instagram, or YouTube tap Share → <strong>Copy link</strong>, then
                  open DishCovered and paste it into <strong>Import</strong>.
                  <Sparkles className="mx-1 inline h-3.5 w-3.5 text-brand" />
                  Done — it&apos;s in Your Recipes. (iPhones don&apos;t allow direct
                  share-to-app for web apps.)
                </>
              ) : (
                <>
                  In TikTok, Instagram, or YouTube tap Share → <strong>DishCovered</strong>.
                  <Sparkles className="mx-1 inline h-3.5 w-3.5 text-brand" />
                  Done — it&apos;s in Your Recipes.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
