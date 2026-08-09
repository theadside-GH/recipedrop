"use client";

import { useState, useTransition } from "react";
import { Globe2, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [pending, startTransition] = useTransition();

  function apply(next: boolean) {
    setConfirmingPublish(false);
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

  function toggle() {
    // Publishing is outward-facing: one tap puts the full recipe on the open
    // web, credited to you — worth one explicit confirm.
    if (!isPublic) setConfirmingPublish(true);
    else apply(false);
  }

  return (
    <>
      <ConfirmDialog
        open={confirmingPublish}
        title="Share this recipe publicly?"
        body="Anyone with the link can see it, and it can appear in Dishcover credited to you. You can flip it back to private anytime."
        confirmLabel="Make it public"
        onConfirm={() => apply(true)}
        onClose={() => setConfirmingPublish(false)}
      />
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
