"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookMarked } from "lucide-react";
import { saveDropAction, unsaveDropAction } from "@/app/actions";
import { cn } from "@/lib/utils";

/**
 * Recipe-book save toggle for dishcovery cards: tap to save the dish into
 * Your Recipes, tap again to take it back out. Fills instantly (optimistic)
 * and rolls back if the server disagrees. Signed-out viewers are sent to
 * sign in and come back to the same page.
 */
export function SaveDropToggle({
  recipeId,
  initialSaved,
  alreadyOwn = false,
  signedIn = true,
  className,
}: {
  recipeId: string;
  initialSaved: boolean;
  /** The viewer imported this dish themselves — nothing to save or unsave. */
  alreadyOwn?: boolean;
  signedIn?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState(initialSaved);
  const [, startTransition] = useTransition();

  if (alreadyOwn) {
    // Saving would dedupe against their own import and silently no-op, so
    // show the truth instead of a toggle that visually reverts.
    return (
      <span
        title="Already in Your Recipes — you imported this yourself"
        aria-label="Already in Your Recipes — you imported this yourself"
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand/40 bg-brand-soft text-brand shadow-sm",
          className,
        )}
      >
        <BookMarked className="h-4 w-4 fill-current" />
      </span>
    );
  }

  function toggle() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      try {
        if (next) await saveDropAction(recipeId);
        else await unsaveDropAction(recipeId);
      } catch {
        setSaved(!next);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Remove from Your Recipes" : "Save to Your Recipes"}
      title={saved ? "In Your Recipes — tap to remove" : "Save to Your Recipes"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors",
        saved
          ? "border-brand bg-brand text-brand-foreground"
          : "border-border bg-card/95 text-foreground hover:bg-surface",
        className,
      )}
    >
      <BookMarked className={cn("h-4 w-4", saved && "fill-current")} />
    </button>
  );
}
