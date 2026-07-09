"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { autopilotPlanAction } from "@/app/actions";
import { cn } from "@/lib/utils";

/**
 * "Plan my week" wizard: one AI call picks recipes from the user's own
 * library and lands them on the finished plan with its shopping list.
 */
export function PlanAutopilot({ hasPantryItems }: { hasPantryItems: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [nights, setNights] = useState(4);
  const [quickMeals, setQuickMeals] = useState(1);
  const [usePantry, setUsePantry] = useState(hasPantryItems);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await autopilotPlanAction({ nights, quickMeals, usePantry });
      if (result.ok) {
        router.push(`/plans/${result.planId}`);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-brand-soft via-card to-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <WandSparkles className="h-5 w-5 text-brand" />
            Plan my week
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Autopilot picks from your recipes and builds the shopping list.
          </p>
        </div>
        {!open && (
          <Button onClick={() => setOpen(true)}>
            <WandSparkles className="h-4 w-4" /> Try it
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-4">
            <Stepper
              label="Dinners"
              value={nights}
              min={1}
              max={7}
              onChange={(v) => {
                setNights(v);
                setQuickMeals((q) => Math.min(q, v));
              }}
            />
            <Stepper
              label="Quick (≤30 min)"
              value={quickMeals}
              min={0}
              max={nights}
              onChange={setQuickMeals}
            />
          </div>
          <label
            className={cn(
              "flex w-fit cursor-pointer items-center gap-2 text-sm",
              !hasPantryItems && "opacity-60",
            )}
          >
            <input
              type="checkbox"
              checked={usePantry}
              disabled={!hasPantryItems}
              onChange={(e) => setUsePantry(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            Use up my pantry &amp; leftovers
            {!hasPantryItems && <span className="text-muted">(pantry is empty)</span>}
          </label>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button onClick={run} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Planning your week...
                </>
              ) : (
                <>
                  <WandSparkles className="h-4 w-4" /> Plan {nights} dinner{nights === 1 ? "" : "s"}
                </>
              )}
            </Button>
            {!isPending && (
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2">
      <span className="text-sm font-medium text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <StepButton disabled={value <= min} onClick={() => onChange(value - 1)} label="−" />
        <span className="w-5 text-center font-semibold tabular-nums">{value}</span>
        <StepButton disabled={value >= max} onClick={() => onChange(value + 1)} label="+" />
      </div>
    </div>
  );
}

function StepButton({
  disabled,
  onClick,
  label,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-sm font-semibold hover:bg-brand-soft disabled:opacity-40"
    >
      {label}
    </button>
  );
}
