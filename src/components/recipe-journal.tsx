"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, Loader2, NotebookPen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { addRecipeNoteAction, deleteRecipeNoteAction } from "@/app/actions";

export interface JournalEntry {
  id: string;
  kind: string; // "note" | "cooked"
  body: string | null;
  createdAt: string; // ISO
}

/**
 * The owner's private journal on a recipe: freeform notes plus a dated
 * "cooked it" log. This is what makes a recipe a living document.
 */
export function RecipeJournal({
  recipeId,
  entries: initialEntries,
}: {
  recipeId: string;
  entries: JournalEntry[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const cooks = entries.filter((entry) => entry.kind === "cooked");

  function add(kind: "note" | "cooked") {
    const body = draft.trim() || null;
    if (kind === "note" && !body) return;
    setError(null);
    startTransition(async () => {
      try {
        await addRecipeNoteAction(recipeId, kind, body);
        setEntries((current) => [
          {
            id: `tmp-${current.length}-${kind}`,
            kind,
            body,
            createdAt: new Date().toISOString(),
          },
          ...current,
        ]);
        setDraft("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "That did not save. Try again.");
      }
    });
  }

  function remove(noteId: string) {
    if (noteId.startsWith("tmp-")) return; // let the refresh catch up first
    if (!confirm("Delete this entry? There's no undo.")) return;
    startTransition(async () => {
      await deleteRecipeNoteAction(recipeId, noteId);
      setEntries((current) => current.filter((entry) => entry.id !== noteId));
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <NotebookPen className="h-5 w-5 text-brand" />
          Your notes
        </h2>
        {cooks.length > 0 && (
          <p className="text-sm text-muted">
            Cooked {cooks.length}&times; &middot; last {formatDate(cooks[0].createdAt)}
          </p>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        Only you can see these. What you changed, what worked, what to try next time.
      </p>

      <div className="mt-4 space-y-3">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          placeholder="e.g. Used thighs instead — 425°F for 18 min. Double the chipotle next time."
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => add("note")} disabled={isPending || !draft.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <NotebookPen className="h-4 w-4" />}
            Save note
          </Button>
          {/* Plain cook logging lives in the "I made it!" button up top — this
              only appears when there's a note to attach to the cook. */}
          {draft.trim() && (
            <Button size="sm" variant="secondary" onClick={() => add("cooked")} disabled={isPending}>
              <ChefHat className="h-4 w-4" />
              Cooked it — save with note
            </Button>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <ul className="mt-5 space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="group flex items-start gap-3 rounded-xl border border-border bg-surface/60 p-3"
            >
              <span className="mt-0.5 shrink-0">
                {entry.kind === "cooked" ? (
                  <ChefHat className="h-4 w-4 text-fresh" />
                ) : (
                  <NotebookPen className="h-4 w-4 text-brand" />
                )}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                {entry.kind === "cooked" && (
                  <span className="font-medium text-fresh">Cooked it</span>
                )}
                {entry.body && (
                  <p className="whitespace-pre-wrap">{entry.body}</p>
                )}
                <p className="mt-0.5 text-xs text-muted">{formatDate(entry.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(entry.id)}
                aria-label="Delete entry"
                title="Delete entry"
                className="shrink-0 rounded-full p-1 text-muted opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
