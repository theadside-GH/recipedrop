"use client";

import { useState, useTransition } from "react";
import { Globe2, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setRecipePublicAction } from "@/app/actions";

export function RecipePublicToggle({
  recipeId,
  initialPublic,
  onChange,
}: {
  recipeId: string;
  initialPublic: boolean;
  onChange?: (isPublic: boolean) => void;
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !isPublic;
    // Publishing is outward-facing: one tap puts the full recipe on the open
    // web, credited to you — worth one explicit confirm.
    if (
      next &&
      !confirm(
        "Make this recipe public? Anyone with the link can see it, and it can appear in Discover credited to you. You can flip it back to private anytime.",
      )
    ) {
      return;
    }
    setIsPublic(next);
    setNotice(null);
    onChange?.(next);
    startTransition(async () => {
      try {
        const result = await setRecipePublicAction(recipeId, next);
        setNotice(result.notice);
      } catch {
        setIsPublic(!next);
        onChange?.(!next);
      }
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" size="lg" onClick={toggle} disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPublic ? (
          <Globe2 className="h-4 w-4" />
        ) : (
          <Lock className="h-4 w-4" />
        )}
        {isPublic ? "Public" : "Private"}
      </Button>
      {notice && (
        <p className="basis-full rounded-xl border border-brand/25 bg-brand-soft p-3 text-sm">
          {notice}
        </p>
      )}
    </>
  );
}
