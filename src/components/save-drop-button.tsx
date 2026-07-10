"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveDropAction } from "@/app/actions";
import { cn } from "@/lib/utils";

/**
 * "Save to Your Recipes" for public drops. The full-size variant navigates to
 * the saved copy so the viewer can cook/edit it; the compact card variant just
 * flips to a saved state in place.
 */
export function SaveDropButton({
  recipeId,
  compact = false,
  className,
}: {
  recipeId: string;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (saved || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveDropAction(recipeId);
        setSaved(true);
        if (!compact) router.push(`/recipes/${result.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save this recipe.");
      }
    });
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={save}
        aria-label={saved ? "Saved to your recipes" : "Save to your recipes"}
        title={saved ? "Saved to your recipes" : "Save to your recipes"}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-full border border-border bg-card/95 px-2.5 text-xs font-semibold text-brand shadow-sm transition-colors hover:bg-surface",
          saved && "border-green-200 bg-green-50 text-green-700",
          className,
        )}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : saved ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <BookmarkPlus className="h-3.5 w-3.5" />
        )}
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <Button type="button" size="lg" onClick={save} disabled={pending || saved}>
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : saved ? (
          <Check className="h-5 w-5" />
        ) : (
          <BookmarkPlus className="h-5 w-5" />
        )}
        {pending ? "Saving..." : saved ? "Saved" : "Save to Your Recipes"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
