"use client";

import { useState, useTransition, type FormEvent } from "react";
import { HelpCircle, Loader2, Plus, WandSparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  checkPantryNameAction,
  setLeftoverItemAction,
  setPantryItemAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";

type PantryKind = "pantry" | "leftover";

type EntryPrompt =
  | { type: "typo"; typed: string; suggested: string }
  | { type: "unknown"; typed: string };

function actionFor(kind: PantryKind) {
  return kind === "pantry" ? setPantryItemAction : setLeftoverItemAction;
}

/**
 * Free-text entry so anything bought or on hand can go in the pantry — the
 * common-items grid and shopping-list check-offs only cover so much.
 * Items match shopping lists by exact name, so nothing unrecognized saves
 * silently: likely typos get a "did you mean" prompt, and names the app has
 * never seen need an explicit "add anyway".
 */
export function AddItemForm({ kind, placeholder }: { kind: PantryKind; placeholder: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState<EntryPrompt | null>(null);
  const [isPending, startTransition] = useTransition();

  async function addItem(finalName: string) {
    await actionFor(kind)({ canonicalName: finalName, aisle: null, checked: true });
    setName("");
    setPrompt(null);
    router.refresh();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = name.trim().toLowerCase();
    if (!cleaned) return;
    startTransition(async () => {
      const check = await checkPantryNameAction(cleaned);
      if (check.known) {
        await addItem(cleaned);
        return;
      }
      if (check.suggestion && check.suggestion !== cleaned) {
        setPrompt({ type: "typo", typed: cleaned, suggested: check.suggestion });
      } else {
        setPrompt({ type: "unknown", typed: cleaned });
      }
    });
  }

  function accept(finalName: string) {
    startTransition(async () => {
      await addItem(finalName);
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setPrompt(null);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm focus:border-brand focus-visible:outline-none"
        />
        <Button type="submit" variant="secondary" disabled={isPending || !name.trim()}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </Button>
      </form>
      {prompt?.type === "typo" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/25 bg-brand-soft p-3 text-sm">
          <WandSparkles className="h-4 w-4 shrink-0 text-brand" />
          <span>
            Did you mean <strong className="capitalize">{prompt.suggested}</strong>?
          </span>
          <span className="flex gap-2">
            <Button size="sm" onClick={() => accept(prompt.suggested)} disabled={isPending}>
              Yes, add {prompt.suggested}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => accept(prompt.typed)}
              disabled={isPending}
            >
              Keep “{prompt.typed}”
            </Button>
          </span>
        </div>
      )}
      {prompt?.type === "unknown" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/25 bg-brand-soft p-3 text-sm">
          <HelpCircle className="h-4 w-4 shrink-0 text-brand" />
          <span>
            “<strong className="capitalize">{prompt.typed}</strong>” doesn’t look like an
            ingredient we know. Fix the spelling, or add it as is.
          </span>
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => accept(prompt.typed)}
              disabled={isPending}
            >
              Add “{prompt.typed}” anyway
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPrompt(null)} disabled={isPending}>
              Never mind
            </Button>
          </span>
        </div>
      )}
    </div>
  );
}

/** Item chips with a remove button, so mistakes and used-up items can go. */
export function RemovableItemChips({ items, kind }: { items: string[]; kind: PantryKind }) {
  const router = useRouter();
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function removeItem(name: string) {
    setPendingName(name);
    startTransition(async () => {
      try {
        await actionFor(kind)({ canonicalName: name, aisle: null, checked: false });
        router.refresh();
      } finally {
        setPendingName(null);
      }
    });
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface py-1 pl-3 pr-1.5 text-xs font-medium capitalize"
        >
          {item}
          <button
            type="button"
            onClick={() => removeItem(item)}
            disabled={pendingName === item}
            aria-label={`Remove ${item}`}
            className="rounded-full p-0.5 text-muted transition-colors hover:bg-border hover:text-foreground disabled:opacity-60"
          >
            {pendingName === item ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </button>
        </span>
      ))}
    </div>
  );
}
