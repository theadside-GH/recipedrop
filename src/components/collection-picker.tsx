"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, Check, Loader2, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  addToCollectionAction,
  createCollectionAction,
  removeFromCollectionAction,
} from "@/app/actions";
import { cn } from "@/lib/utils";

export interface PickerCollection {
  id: string;
  name: string;
  /** Whether this recipe is already in the collection. */
  has: boolean;
}

/** "Add to collection" dropdown on a recipe page (owner view). */
export function CollectionPicker({
  recipeId,
  collections: initial,
}: {
  recipeId: string;
  collections: PickerCollection[];
}) {
  const router = useRouter();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [collections, setCollections] = useState(initial);
  const [newName, setNewName] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const inCount = collections.filter((c) => c.has).length;

  function toggle(target: PickerCollection) {
    setPendingId(target.id);
    startTransition(async () => {
      try {
        if (target.has) await removeFromCollectionAction(target.id, recipeId);
        else await addToCollectionAction(target.id, recipeId);
        setCollections((current) =>
          current.map((c) => (c.id === target.id ? { ...c, has: !target.has } : c)),
        );
      } finally {
        setPendingId(null);
      }
    });
  }

  function createAndAdd() {
    const name = newName.trim();
    if (!name) return;
    setPendingId("new");
    startTransition(async () => {
      try {
        const { id } = await createCollectionAction(name);
        await addToCollectionAction(id, recipeId);
        setCollections((current) => [...current, { id, name, has: true }]);
        setNewName("");
        router.refresh();
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <details ref={detailsRef} className="group relative">
      <summary
        className={cn(
          buttonVariants({ variant: "secondary", size: "lg" }),
          "cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden",
        )}
      >
        <BookMarked className="h-4 w-4" />
        {inCount > 0 ? `In ${inCount} collection${inCount === 1 ? "" : "s"}` : "Add to collection"}
      </summary>
      <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-2xl border border-border bg-card p-2 shadow-card-hover">
        {collections.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted">No collections yet — create one below.</p>
        )}
        <ul className="max-h-56 overflow-y-auto">
          {collections.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => toggle(c)}
                disabled={pendingId !== null}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-surface"
              >
                <span
                  className={cn(
                    "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border",
                    c.has ? "border-brand bg-brand text-brand-foreground" : "border-border bg-card",
                  )}
                >
                  {pendingId === c.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    c.has && <Check className="h-3 w-3" />
                  )}
                </span>
                <span className="truncate">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-1 flex items-center gap-1 border-t border-border pt-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
            placeholder="New collection..."
            className="h-9 min-w-0 flex-1 rounded-full border border-border bg-background px-3 text-sm focus:border-brand focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={createAndAdd}
            disabled={pendingId !== null || !newName.trim()}
            aria-label="Create collection and add this recipe"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground disabled:opacity-40"
          >
            {pendingId === "new" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </details>
  );
}
