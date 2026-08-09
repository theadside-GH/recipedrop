"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { setRecipeRatingAction } from "@/app/actions";

/**
 * The owner's private "would I make this again?" rating. Tap a star to set;
 * tap the current rating again to clear. Private like favorites — only ever
 * rendered on owner surfaces.
 */
export function StarRating({
  recipeId,
  initialRating,
  className,
}: {
  recipeId: string;
  initialRating: number | null;
  className?: string;
}) {
  const [rating, setRating] = useState(initialRating);
  const [, startTransition] = useTransition();

  function set(next: number) {
    const value = next === rating ? null : next;
    const previous = rating;
    setRating(value);
    startTransition(async () => {
      try {
        await setRecipeRatingAction(recipeId, value);
      } catch {
        setRating(previous);
      }
    });
  }

  return (
    <div className={cn("flex items-center gap-1", className)} role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((value) => {
        const filled = rating != null && value <= rating;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
            title={
              rating === value ? "Tap again to clear your rating" : `Rate ${value} of 5`
            }
            onClick={() => set(value)}
            className="rounded-full p-0.5 transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                "h-5 w-5",
                // foreground/25 (not border) so empty stars stay visible on
                // dark cards too.
                filled ? "fill-amber-400 text-amber-400" : "text-foreground/25",
              )}
            />
          </button>
        );
      })}
      <span className="ml-1 text-xs text-muted">
        {rating ? `${rating}/5` : "Rate it"}
      </span>
    </div>
  );
}

/** Read-only star row for cards/lists. Renders nothing when unrated. */
export function StarBadge({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`You rated this ${rating} of 5`}
    >
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      {rating}
    </span>
  );
}
