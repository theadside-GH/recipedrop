"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BookMarked, Check, Loader2, Plus, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  addDropToCollectionAction,
  addToCollectionAction,
  createCollectionAction,
  removeDropFromCollectionAction,
  removeFromCollectionAction,
} from "@/app/actions";
import { cn } from "@/lib/utils";

export interface PickerCollection {
  id: string;
  name: string;
  /** Whether this recipe is already in the collection. */
  has: boolean;
}

/**
 * Shared list + create-new state for both picker shapes. When `dropSource` is
 * set, `recipeId` is someone else's public drop: adding saves it into Your
 * Recipes first, then files the copy.
 */
function usePickerState(recipeId: string, initial: PickerCollection[], dropSource: boolean) {
  const router = useRouter();
  const [collections, setCollections] = useState(initial);
  const [newName, setNewName] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const add = dropSource ? addDropToCollectionAction : addToCollectionAction;
  const remove = dropSource ? removeDropFromCollectionAction : removeFromCollectionAction;

  function toggle(target: PickerCollection) {
    setPendingId(target.id);
    startTransition(async () => {
      try {
        if (target.has) await remove(target.id, recipeId);
        else await add(target.id, recipeId);
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
        await add(id, recipeId);
        setCollections((current) => [...current, { id, name, has: true }]);
        setNewName("");
        router.refresh();
      } finally {
        setPendingId(null);
      }
    });
  }

  return { collections, newName, setNewName, pendingId, toggle, createAndAdd };
}

function PickerPanelBody({
  state,
  hint,
}: {
  state: ReturnType<typeof usePickerState>;
  hint?: string;
}) {
  const { collections, newName, setNewName, pendingId, toggle, createAndAdd } = state;
  return (
    <>
      {hint && <p className="px-3 pb-1 pt-2 text-xs text-muted">{hint}</p>}
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
    </>
  );
}

/** "Add to collection" dropdown on a recipe page. */
export function CollectionPicker({
  recipeId,
  collections: initial,
  dropSource = false,
}: {
  recipeId: string;
  collections: PickerCollection[];
  /** recipeId is another cook's public drop — adding also saves it to Your Recipes. */
  dropSource?: boolean;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const state = usePickerState(recipeId, initial, dropSource);
  const inCount = state.collections.filter((c) => c.has).length;

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
        <PickerPanelBody
          state={state}
          hint={dropSource ? "Also saves the recipe into Your Recipes." : undefined}
        />
      </div>
    </details>
  );
}

/**
 * Compact add-to-collection for recipe cards: a small round button on the
 * photo that opens a centered popup, so you can file a recipe without opening
 * it. The popup renders in a portal — card corners clip and cards transform on
 * hover, so an in-place dropdown would be cut off or mispositioned.
 */
export function CollectionQuickAdd({
  recipeId,
  collections: initial,
  dropSource = false,
  className,
}: {
  recipeId: string;
  collections: PickerCollection[];
  dropSource?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const state = usePickerState(recipeId, initial, dropSource);
  const inCount = state.collections.filter((c) => c.has).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const title =
    inCount > 0
      ? `In ${inCount} collection${inCount === 1 ? "" : "s"} — tap to change`
      : "Add to a collection";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={title}
        title={title}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors",
          inCount > 0
            ? "border-brand/40 bg-brand-soft text-brand"
            : "border-border bg-card/95 text-foreground hover:bg-surface",
          className,
        )}
      >
        <BookMarked className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/30"
            />
            <div
              role="dialog"
              aria-label="Add to collection"
              className="relative w-full max-w-xs rounded-2xl border border-border bg-card p-2 shadow-card-hover"
            >
              <div className="flex items-center justify-between px-3 pb-1 pt-2">
                <p className="text-sm font-semibold">Add to collection</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-full p-1 text-muted hover:bg-surface hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <PickerPanelBody
                state={state}
                hint={dropSource ? "Also saves the recipe into Your Recipes." : undefined}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
