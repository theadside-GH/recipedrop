"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe2, Loader2, Lock, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteCollectionAction,
  removeFromCollectionAction,
  renameCollectionAction,
  setCollectionPublicAction,
} from "@/app/actions";

export function CollectionName({ id, initialName }: { id: string; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [, startTransition] = useTransition();

  function save() {
    const next = name.trim();
    if (!next || next === initialName) return;
    startTransition(async () => {
      try {
        await renameCollectionAction(id, next);
      } catch {
        setName(initialName);
      }
    });
  }

  return (
    <Input
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      aria-label="Collection name"
      className="max-w-md font-display text-xl font-semibold"
    />
  );
}

export function CollectionPublicToggle({
  id,
  initialPublic,
}: {
  id: string;
  initialPublic: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    const next = !isPublic;
    setIsPublic(next);
    startTransition(async () => {
      try {
        await setCollectionPublicAction(id, next);
        router.refresh();
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

export function DeleteCollectionButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm(`Delete the collection "${name}"? Recipes themselves are kept.`)) return;
    startTransition(async () => {
      await deleteCollectionAction(id);
      router.push("/collections");
    });
  }

  return (
    <Button type="button" variant="danger" size="lg" onClick={remove} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      Delete
    </Button>
  );
}

export function RemoveFromCollectionButton({
  collectionId,
  recipeId,
}: {
  collectionId: string;
  recipeId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      await removeFromCollectionAction(collectionId, recipeId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      aria-label="Remove from collection"
      title="Remove from collection"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-sm transition-colors hover:bg-red-50 hover:text-red-600"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
    </button>
  );
}
