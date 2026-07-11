"use client";

import { useEffect, useState } from "react";
import { X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && Boolean(window.navigator.standalone));
    if (standalone || window.localStorage.getItem("recipedrop-install-dismissed") === "1") {
      return;
    }

    const ua = window.navigator.userAgent;
    const looksAndroidChrome = /Android/i.test(ua) && /Chrome/i.test(ua) && !/wv/i.test(ua);
    let timeout: number | null = null;
    if (looksAndroidChrome) {
      timeout = window.setTimeout(() => setShow(true), 0);
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setShow(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      if (timeout) window.clearTimeout(timeout);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  async function install() {
    if (!installEvent) {
      setManual(true);
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setShow(false);
    setInstallEvent(null);
  }

  function dismiss() {
    window.localStorage.setItem("recipedrop-install-dismissed", "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6 print:hidden">
      <div className="flex gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Smartphone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install DishCovered on this phone</p>
          {manual ? (
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs leading-5 text-muted">
              <li>Open DishCovered in Chrome, not inside TikTok or Instagram.</li>
              <li>Tap Chrome&apos;s three-dot menu.</li>
              <li>Choose Install app or Add to Home screen.</li>
            </ol>
          ) : (
            <p className="mt-0.5 text-xs leading-5 text-muted">
              Use it from your home screen and share recipes straight into the app.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={install}>
              {installEvent ? "Install app" : "How to install"}
            </Button>
            {installEvent && (
              <Button size="sm" variant="ghost" onClick={() => setManual(true)}>
                Show steps
              </Button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install message"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
