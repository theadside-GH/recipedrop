import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Globe } from "lucide-react";
import { getOwnerEmail } from "@/lib/auth";
import { getCollectionFull } from "@/lib/repo/collections";
import { cookedCountsForOwner } from "@/lib/repo/notes";
import { FavoriteButton } from "@/components/favorite-button";
import { MadeItButton } from "@/components/made-it-button";
import { RecipeCard } from "@/components/recipe-card";
import { ShareLinkButton } from "@/components/share-link-button";
import {
  CollectionName,
  CollectionPublicToggle,
  DeleteCollectionButton,
  RemoveFromCollectionButton,
} from "./collection-controls";

export const dynamic = "force-dynamic";

export default async function ManageCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, owner] = await Promise.all([getCollectionFull(id), getOwnerEmail()]);
  // The manage page is owner-only; others see the public page (or nothing).
  if (!data || data.collection.ownerEmail !== owner) notFound();

  const privateCount = data.recipes.filter((r) => !r.isPublic).length;
  const cookedCounts = await cookedCountsForOwner(owner, data.recipes.map((r) => r.id));

  return (
    <div className="space-y-5">
      <Link
        href="/collections"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All collections
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <CollectionName id={data.collection.id} initialName={data.collection.name} />
        <div className="flex flex-wrap gap-2">
          <CollectionPublicToggle
            id={data.collection.id}
            initialPublic={data.collection.isPublic}
          />
          {data.collection.isPublic && (
            <ShareLinkButton href={`/c/${data.collection.id}`} label="Copy share link" />
          )}
          <DeleteCollectionButton id={data.collection.id} name={data.collection.name} />
        </div>
      </div>

      {data.collection.isPublic && privateCount > 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3 text-sm text-muted">
          <Globe className="h-4 w-4 shrink-0" />
          {privateCount} recipe{privateCount === 1 ? " is" : "s are"}{" "}
          private and won&apos;t show on your shared page. Make a recipe public from its own page
          to include it.
        </p>
      )}

      {data.recipes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center text-muted">
          Nothing in here yet. Open any of your recipes and use &ldquo;Add to collection&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.recipes.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              topRightSlot={
                <RemoveFromCollectionButton collectionId={data.collection.id} recipeId={r.id} />
              }
              actionsRow={
                <>
                  <FavoriteButton recipeId={r.id} initialFavorite={r.isFavorite} />
                  <MadeItButton recipeId={r.id} initialCount={cookedCounts.get(r.id) ?? 0} />
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
