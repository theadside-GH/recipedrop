"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleUserRound, Loader2, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { addRecipeCommentAction, deleteRecipeCommentAction } from "@/app/actions";

export interface CommentEntry {
  id: string;
  body: string;
  createdAt: string; // ISO
  authorName: string;
  authorHandle: string | null;
  authorAvatar: string | null;
  mine: boolean;
}

/**
 * The comment thread on a shared dishcovery. Everyone who can see the recipe
 * sees the same thread; posting needs a signed-in account. Authors can delete
 * their own comments, and the dish's owner can remove any comment on it.
 */
export function RecipeComments({
  recipeId,
  entries: initialEntries,
  signedIn = true,
  canModerate = false,
}: {
  recipeId: string;
  entries: CommentEntry[];
  signedIn?: boolean;
  /** The viewer owns this recipe and may remove any comment. */
  canModerate?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [entries, setEntries] = useState(initialEntries);
  const [draft, setDraft] = useState("");
  // router.refresh() after post/delete sends down the authoritative thread —
  // adopt it so the optimistic "You" entry becomes the real comment (with its
  // handle and a deletable id) and other cooks' comments appear. Render-phase
  // reset instead of an effect, per react.dev/learn/you-might-not-need-an-effect.
  const [adoptedEntries, setAdoptedEntries] = useState(initialEntries);
  if (adoptedEntries !== initialEntries) {
    setAdoptedEntries(initialEntries);
    setEntries(initialEntries);
  }
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function post() {
    const body = draft.trim();
    if (!body) return;
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addRecipeCommentAction(recipeId, body);
        setEntries((current) => [
          ...current,
          {
            id: `tmp-${crypto.randomUUID()}`,
            body,
            createdAt: new Date().toISOString(),
            authorName: "You",
            authorHandle: null,
            authorAvatar: null,
            mine: true,
          },
        ]);
        setDraft("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "That did not post. Try again.");
      }
    });
  }

  function remove(commentId: string) {
    if (commentId.startsWith("tmp-")) return; // let the refresh catch up first
    if (!confirm("Delete this comment? There's no undo.")) return;
    startTransition(async () => {
      try {
        await deleteRecipeCommentAction(recipeId, commentId);
        setEntries((current) => current.filter((entry) => entry.id !== commentId));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "That did not delete. Try again.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 print:hidden">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <MessageCircle className="h-5 w-5 text-brand" />
        Comments
        {entries.length > 0 && (
          <span className="text-sm font-normal text-muted">· {entries.length}</span>
        )}
      </h2>
      <p className="mt-1 text-sm text-muted">
        Everyone who can see this dish sees these — tips, swaps, and how it turned out.
      </p>

      {entries.length > 0 && (
        <ul className="mt-4 space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="group flex items-start gap-3 rounded-xl border border-border bg-surface/60 p-3"
            >
              {entry.authorAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.authorAvatar}
                  alt=""
                  className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <CircleUserRound className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  {entry.authorHandle ? (
                    <Link
                      href={`/u/${entry.authorHandle}`}
                      className="font-medium hover:text-brand hover:underline"
                    >
                      {entry.authorName}
                    </Link>
                  ) : (
                    <span className="font-medium">{entry.authorName}</span>
                  )}
                  <span className="text-xs text-muted">{formatDate(entry.createdAt)}</span>
                </p>
                <p className="whitespace-pre-wrap">{entry.body}</p>
              </div>
              {(entry.mine || canModerate) && (
                <button
                  type="button"
                  onClick={() => remove(entry.id)}
                  aria-label="Delete comment"
                  title={entry.mine ? "Delete your comment" : "Remove this comment from your dish"}
                  className="shrink-0 rounded-full p-1 text-muted transition-opacity hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-3">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          maxLength={2000}
          placeholder={
            signedIn
              ? "e.g. Swapped the feta for goat cheese — even better."
              : "Sign in to join the conversation."
          }
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button size="sm" onClick={post} disabled={isPending || !draft.trim()}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageCircle className="h-4 w-4" />
          )}
          Post comment
        </Button>
      </div>
    </section>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
