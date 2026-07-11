"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveDropAction } from "@/app/actions";
import { cn } from "@/lib/utils";

/**
 * "Save to Your Recipes" on the public recipe page. Navigates to the saved
 * copy so the viewer can cook/edit it. (Cards use SaveDropToggle instead.)
 */
export function SaveDropButton({
  recipeId,
  className,
}: {
  recipeId: string;
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
        router.push(`/recipes/${result.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save this recipe.");
      }
    });
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
