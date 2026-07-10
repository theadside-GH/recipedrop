"use client";

import { useSyncExternalStore } from "react";
import { Share, Smartphone, X } from "lucide-react";
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

  if (installed || dismissed === "1") return null;

  return (
    <div className="relative rounded-2xl border border-brand/25 bg-brand-soft p-5 pr-12">
      <button
        type="button"
        onClick={() => setDismissed("1")}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-full p-1.5 text-muted transition-colors hover:bg-card hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="flex items-center gap-2 font-semibold">
        <Smartphone className="h-5 w-5 text-brand" />
        Save recipes in two taps
      </p>
      <ol className="mt-2 space-y-1.5 text-sm text-muted">
        <li>
          <span className="font-medium text-foreground">1. Put RecipeDrop on your phone:</span>{" "}
          on iPhone open this site in Safari and tap Share → &quot;Add to Home Screen&quot;; on
          Android tap the menu → &quot;Install app&quot;.
        </li>
        <li>
          <span className="font-medium text-foreground">
            2. Then, in TikTok, Instagram, or YouTube:
          </span>{" "}
          tap <Share className="inline h-3.5 w-3.5" /> Share on any recipe video →{" "}
          <span className="font-medium text-foreground">RecipeDrop</span> — it turns the video
          into a clean recipe automatically.
        </li>
      </ol>
    </div>
  );
}
