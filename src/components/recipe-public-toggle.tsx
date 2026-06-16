"use client";

import { useState, useTransition } from "react";
import { Globe2, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setRecipePublicAction } from "@/app/actions";

export function RecipePublicToggle({
  recipeId,
  initialPublic,
}: {
  recipeId: string;
  initialPublic: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !isPublic;
    setIsPublic(next);
    startTransition(async () => {
      try {
        await setRecipePublicAction(recipeId, next);
      } catch {
        setIsPublic(!next);
      }
    });
  }

  return (
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
  );
}
