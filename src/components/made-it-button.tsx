"use client";

import { useState, useTransition } from "react";
import { ChefHat, Loader2 } from "lucide-react";
import { setMadeItAction } from "@/app/actions";
import { cn } from "@/lib/utils";

/**
 * The "I made it!" toggle for the owner's own recipes. Tapping logs a dated
 * cook — which is what puts the recipe in the library's Made it list — and
 * tapping again removes just the latest log, so a mis-tap is a free undo.
 *
 * Icon form sits bottom-right on thumbnails; labeled form is the big button
 * on the recipe page.
 */
export function MadeItButton({
  recipeId,
  initialCount,
  labeled = false,
  className,
}: {
  recipeId: string;
  initialCount: number;
  labeled?: boolean;
  className?: string;
}) {
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();
  const made = count > 0;

  function toggle() {
    const next = !made;
    // Flip instantly — the hat is the feedback. Roll back only on failure.
    setCount((current) => (next ? current + 1 : Math.max(0, current - 1)));
    startTransition(async () => {
      try {
        await setMadeItAction(recipeId, next);
      } catch {
        setCount((current) => (next ? Math.max(0, current - 1) : current + 1));
      }
    });
  }

  const title = made
    ? "In your Made it list — tap to remove your latest log"
    : "Adds this recipe to your Made it list";

  if (labeled) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={made}
        title={title}
        className={cn(
          "inline-flex h-13 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-7 text-base font-medium transition-all active:scale-[0.98]",
          made
            ? "border-fresh/40 bg-fresh-soft text-fresh"
            : "border-border bg-surface text-foreground hover:bg-fresh-soft hover:text-fresh",
          className,
        )}
      >
        {isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ChefHat className={cn("h-5 w-5", made && "fill-current")} />
        )}
        {made ? (count > 1 ? `Made it ${count}×` : "Made it ✓") : "I made it!"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={made}
      aria-label={title}
      title={title}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-sm transition-colors hover:bg-surface",
        made && "border-fresh/40 bg-fresh-soft text-fresh",
        className,
      )}
    >
      <ChefHat className={cn("h-4 w-4", made && "fill-current")} />
    </button>
  );
}
