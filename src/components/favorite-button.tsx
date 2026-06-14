"use client";

import { useState, useTransition } from "react";
import { Heart, Loader2 } from "lucide-react";
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
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !favorite;
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
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-sm transition-colors hover:bg-surface",
        favorite && "border-red-200 bg-red-50 text-red-600",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={cn("h-4 w-4", favorite && "fill-current")} />
      )}
    </button>
  );
}
