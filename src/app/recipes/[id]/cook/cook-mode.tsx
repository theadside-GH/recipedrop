"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Pause,
  Pencil,
  Play,
  Timer,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CookStep {
  number: number;
  instruction: string;
  durationMinutes: number | null;
}

/**
 * Per-step timer state, owned by CookMode so timers keep counting while the
 * cook reads ahead or steps back. Running timers hold a wall-clock deadline;
 * paused ones hold the seconds left.
 */
type TimerState = { endsAt: number } | { remaining: number };

export function CookMode({
  recipeId,
  exitHref,
  editHref,
  title,
  steps,
  ingredients,
  servingsNote = null,
}: {
  recipeId: string;
  /** Where the X/Done buttons return to (the owner page or the public page). */
  exitHref?: string;
  /** Owner-only link for fixing a recipe with no steps. */
  editHref?: string;
  title: string;
  steps: CookStep[];
  ingredients: { text: string; note: string | null }[];
  /** e.g. "Scaled for 6 servings" when cooking at a non-default size. */
  servingsNote?: string | null;
}) {
  const router = useRouter();
  const exit = exitHref ?? `/recipes/${recipeId}`;
  const [i, setI] = useState(0);
  const [showIngredients, setShowIngredients] = useState(true);
  const [timers, setTimers] = useState<Record<number, TimerState>>({});
  const [now, setNow] = useState(() => Date.now());
  const total = steps.length;
  const step = steps[i] as CookStep | undefined;

  useWakeLock();

  const anyRunning = Object.values(timers).some((t) => "endsAt" in t);
  const timersRef = useRef(timers);
  useEffect(() => {
    timersRef.current = timers;
  }, [timers]);

  // One shared tick drives every running timer, so a countdown that hits zero
  // beeps no matter which step is on screen.
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => {
      const nowMs = Date.now();
      const due = Object.keys(timersRef.current).filter((key) => {
        const t = timersRef.current[Number(key)];
        return "endsAt" in t && t.endsAt <= nowMs;
      });
      if (due.length > 0) {
        notifyDone();
        setTimers((prev) => {
          const copy = { ...prev };
          for (const key of due) copy[Number(key)] = { remaining: 0 };
          return copy;
        });
      }
      setNow(nowMs);
    }, 1000);
    return () => clearInterval(id);
  }, [anyRunning]);

  function remainingFor(s: CookStep): number {
    const t = timers[s.number];
    if (!t) return (s.durationMinutes ?? 0) * 60;
    if ("endsAt" in t) return Math.max(0, Math.round((t.endsAt - now) / 1000));
    return t.remaining;
  }

  function toggleTimer(s: CookStep) {
    setTimers((prev) => {
      const copy = { ...prev };
      const current = copy[s.number];
      if (current && "endsAt" in current) {
        copy[s.number] = {
          remaining: Math.max(0, Math.round((current.endsAt - Date.now()) / 1000)),
        };
      } else {
        const paused = current && "remaining" in current ? current.remaining : 0;
        const base = paused > 0 ? paused : (s.durationMinutes ?? 0) * 60;
        copy[s.number] = { endsAt: Date.now() + base * 1000 };
      }
      return copy;
    });
  }

  const runningElsewhere = steps.filter(
    (s) => s.number !== step?.number && timers[s.number] && "endsAt" in timers[s.number],
  );

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

  // No steps (a partial import): the ingredients still deserve a cook view —
  // never a dead end that hides what the recipe does have.
  if (total === 0) {
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
          <span className="h-11 w-11" />
        </div>
        <div className="flex flex-1 items-start justify-center overflow-y-auto px-6">
          <div className="w-full max-w-md py-6">
            <h2 className="mb-1 text-center text-lg font-semibold">Ingredients</h2>
            {servingsNote && (
              <p className="mb-3 text-center text-xs text-muted">{servingsNote}</p>
            )}
            <IngredientList ingredients={ingredients} />
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              This recipe has no steps yet — the import couldn&apos;t find any.
              {editHref ? " Add them and cook mode will walk you through." : ""}
            </div>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="secondary" onClick={() => router.push(exit)}>
                <ChevronLeft className="h-5 w-5" /> Back to recipe
              </Button>
              {editHref && (
                <Link href={editHref}>
                  <Button>
                    <Pencil className="h-4 w-4" /> Add steps
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
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
        {runningElsewhere.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {runningElsewhere.map((s) => (
              <button
                key={s.number}
                onClick={() => {
                  setShowIngredients(false);
                  setI(steps.indexOf(s));
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-xs font-medium text-brand"
                title="Jump to this step"
              >
                <Timer className="h-3.5 w-3.5" />
                Step {steps.indexOf(s) + 1} · {formatSeconds(remainingFor(s))}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-y-auto px-6">
        {showIngredients ? (
          <div className="w-full max-w-md py-6">
            <h2 className="mb-1 text-center text-lg font-semibold">Ingredients</h2>
            {servingsNote && (
              <p className="mb-3 text-center text-xs text-muted">{servingsNote}</p>
            )}
            <IngredientList ingredients={ingredients} />
          </div>
        ) : (
          <div className="max-w-2xl py-8 text-center">
            <p className="text-2xl font-semibold leading-relaxed sm:text-4xl sm:leading-relaxed">
              {step!.instruction}
            </p>
            {step!.durationMinutes ? (
              <div className="mt-8 flex justify-center">
                <StepTimer
                  remaining={remainingFor(step!)}
                  running={!!timers[step!.number] && "endsAt" in timers[step!.number]}
                  onToggle={() => toggleTimer(step!)}
                />
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

function IngredientList({ ingredients }: { ingredients: { text: string; note: string | null }[] }) {
  return (
    <ul className="space-y-2">
      {ingredients.map((ing, idx) => (
        <li key={idx} className="rounded-xl border border-border bg-card p-3 text-sm">
          {ing.text}
          {ing.note && <span className="text-muted"> - {ing.note}</span>}
        </li>
      ))}
    </ul>
  );
}

function StepTimer({
  remaining,
  running,
  onToggle,
}: {
  remaining: number;
  running: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface px-5 py-3">
      <Timer className="h-6 w-6 text-brand" />
      <span className="font-mono text-3xl font-semibold tabular-nums">
        {formatSeconds(remaining)}
      </span>
      <Button variant="secondary" onClick={onToggle}>
        {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {running ? "Pause" : remaining === 0 ? "Reset" : "Start"}
      </Button>
    </div>
  );
}

function formatSeconds(total: number): string {
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
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
