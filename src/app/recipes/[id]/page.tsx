import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOwnerEmail } from "@/lib/auth";
import { getRecipeFull } from "@/lib/repo/recipes";
import { listCollectionIdsForRecipe, listCollections } from "@/lib/repo/collections";
import { listRecipeNotes } from "@/lib/repo/notes";
import { RecipeDetail } from "@/components/recipe-detail";
import { CollectionPicker } from "@/components/collection-picker";
import { MadeItButton } from "@/components/made-it-button";
import { RecipeJournal } from "@/components/recipe-journal";

export const dynamic = "force-dynamic";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, viewer] = await Promise.all([getRecipeFull(id), getOwnerEmail()]);
  if (!data) notFound();
  if (data.recipe.ownerEmail !== viewer) {
    // Not yours: show the public view (or nothing if it isn't shared).
    if (data.recipe.isPublic) redirect(`/r/${id}`);
    notFound();
  }

  const [collections, memberIds, notes] = await Promise.all([
    listCollections(viewer),
    listCollectionIdsForRecipe(viewer, id),
    listRecipeNotes(viewer, id),
  ]);
  const inCollections = new Set(memberIds);
  const cookedCount = notes.filter((note) => note.kind === "cooked").length;

  return (
    <div className="space-y-5">
      <Link
        href="/recipes"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All recipes
      </Link>
      <RecipeDetail
        // On a saved copy, savedFromEmail is another cook's address — keep it
        // out of the client payload.
        recipe={{ ...data.recipe, savedFromEmail: null }}
        ingredients={data.ingredients}
        steps={data.steps}
        tags={data.tags}
        dropperName={data.dropper?.handle ? `@${data.dropper.handle}` : data.dropper?.displayName}
        dropperAvatar={data.dropper?.avatarUrl}
        actionsSlot={
          <>
            {/* key: journal "Cooked it" entries change the count server-side —
                remount so the toggle never shows stale state after refresh. */}
            <MadeItButton key={`made-${cookedCount}`} recipeId={id} initialCount={cookedCount} labeled />
            <CollectionPicker
              recipeId={id}
              collections={collections.map((c) => ({
                id: c.id,
                name: c.name,
                has: inCollections.has(c.id),
              }))}
            />
          </>
        }
      />
      <RecipeJournal
        recipeId={id}
        entries={notes.map((note) => ({
          id: note.id,
          kind: note.kind,
          body: note.body,
          createdAt: note.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
