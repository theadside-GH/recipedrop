"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ListChecks, Pause, Play, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CookStep {
  number: number;
  instruction: string;
  durationMinutes: number | null;
}

export function CookMode({
  recipeId,
  exitHref,
  title,
  steps,
  ingredients,
}: {
  recipeId: string;
  /** Where the X/Done buttons return to (the owner page or the public page). */
  exitHref?: string;
  title: string;
  steps: CookStep[];
  ingredients: { text: string; note: string | null }[];
}) {
  const router = useRouter();
  const exit = exitHref ?? `/recipes/${recipeId}`;
  const [i, setI] = useState(0);
  const [showIngredients, setShowIngredients] = useState(true);
  const total = steps.length;
  const step = steps[i];

  useWakeLock();

  const next = useCallback(() => setI((v) => Math.min(total - 1, v + 1)), [total]);
  const prev = useCallback(() => setI((v) => Math.max(0, v - 1)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        if (showIngredients) setShowIngredients(false);
        else next();
      }
      if (e.key === "ArrowLeft") {
        if (!showIngredients && i === 0) setShowIngredients(true);
        else prev();
      }
      if (e.key === "Escape") router.push(exit);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, next, prev, router, exit, showIngredients]);

  if (!step) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <p className="text-muted">This recipe has no steps.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-5 py-4">
        <button
          onClick={() => router.push(exit)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface hover:bg-brand-soft"
          aria-label="Exit cooking mode"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="truncate px-3 text-sm font-medium text-muted">{title}</p>
        <button
          onClick={() => setShowIngredients((v) => !v)}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full hover:bg-brand-soft",
            showIngredients ? "bg-brand-soft text-brand" : "bg-surface",
          )}
          aria-label="Toggle ingredients"
        >
          <ListChecks className="h-5 w-5" />
        </button>
      </div>

      <div className="px-5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: showIngredients ? "8%" : `${((i + 1) / total) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-center text-sm font-medium text-muted">
          {showIngredients ? "Ingredients" : `Step ${i + 1} of ${total}`}
        </p>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-y-auto px-6">
        {showIngredients ? (
          <div className="w-full max-w-md py-6">
            <h2 className="mb-4 text-center text-lg font-semibold">Ingredients</h2>
            <ul className="space-y-2">
              {ingredients.map((ing, idx) => (
                <li key={idx} className="rounded-xl border border-border bg-card p-3 text-sm">
                  {ing.text}
                  {ing.note && <span className="text-muted"> - {ing.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="max-w-2xl py-8 text-center">
            <p className="text-2xl font-semibold leading-relaxed sm:text-4xl sm:leading-relaxed">
              {step.instruction}
            </p>
            {step.durationMinutes ? (
              <div className="mt-8 flex justify-center">
                {/* Keyed by step so the countdown resets instead of bleeding into the next step. */}
                <StepTimer key={step.number} minutes={step.durationMinutes} />
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border p-5">
        {showIngredients ? (
          <>
            <Button variant="secondary" size="lg" onClick={() => router.push(exit)}>
              <ChevronLeft className="h-5 w-5" /> Recipe
            </Button>
            <Button size="lg" onClick={() => setShowIngredients(false)} className="flex-1 sm:flex-none">
              Start steps <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              size="lg"
              onClick={i === 0 ? () => setShowIngredients(true) : prev}
            >
              <ChevronLeft className="h-5 w-5" /> Back
            </Button>
            {i === total - 1 ? (
              <Button size="lg" onClick={() => router.push(exit)}>
                Done
              </Button>
            ) : (
              <Button size="lg" onClick={next} className="flex-1 sm:flex-none">
                Next <ChevronRight className="h-5 w-5" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StepTimer({ minutes }: { minutes: number }) {
  const [remaining, setRemaining] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            clearInterval(ref.current!);
            setRunning(false);
            notifyDone();
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [running]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface px-5 py-3">
      <Timer className="h-6 w-6 text-brand" />
      <span className="font-mono text-3xl font-semibold tabular-nums">
        {mm}:{ss.toString().padStart(2, "0")}
      </span>
      <Button
        variant="secondary"
        onClick={() => {
          if (remaining === 0) setRemaining(minutes * 60);
          setRunning((r) => !r);
        }}
      >
        {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {running ? "Pause" : remaining === 0 ? "Reset" : "Start"}
      </Button>
    </div>
  );
}

function notifyDone() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio is optional; vibration/visual feedback is enough.
  }
}

function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let released = false;
    async function acquire() {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // Not supported or denied.
      }
    }
    acquire();
    function onVisible() {
      if (document.visibilityState === "visible" && !released) acquire();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);
}
