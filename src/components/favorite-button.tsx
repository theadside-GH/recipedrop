"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { setFavoriteAction } from "@/app/actions";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  recipeId,
  initialFavorite,
  className,
}: {
  recipeId: string;
  initialFavorite: boolean;
  className?: string;
}) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !favorite;
    // Flip instantly — the heart is the feedback. The server catches up in the
    // background and we only roll back if it failed.
    setFavorite(next);
    startTransition(async () => {
      try {
        await setFavoriteAction(recipeId, next);
      } catch {
        setFavorite(!next);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={favorite}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-sm transition-colors hover:bg-surface",
        favorite && "border-red-200 bg-red-50 text-red-600",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4", favorite && "fill-current")} />
    </button>
  );
}
