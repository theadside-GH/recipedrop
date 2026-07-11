import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookMarked, CircleUserRound } from "lucide-react";
import { getViewerEmail } from "@/lib/auth";
import { getCollectionFull } from "@/lib/repo/collections";
import { ownImportIdsFor, savedCopyIdsFor } from "@/lib/repo/recipes";
import { RecipeCard } from "@/components/recipe-card";
import { SaveDropToggle } from "@/components/save-drop-toggle";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCollectionFull(id);
  if (!data || !data.collection.isPublic) return {};
  const title = data.collection.name;
  const description =
    data.collection.description ?? "A shared recipe collection on DishCovered.";
  return { title, description, openGraph: { title, description } };
}

/** Public, shareable view of a collection. Shows only recipes that are public. */
export default async function PublicCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, viewer] = await Promise.all([getCollectionFull(id), getViewerEmail()]);
  if (!data || !data.collection.isPublic) notFound();
  const isOwner = data.collection.ownerEmail === viewer;
  const recipes = data.recipes.filter((r) => r.isPublic && !r.isHidden);
  const byline = data.owner?.handle ? `@${data.owner.handle}` : data.owner?.displayName;
  const [savedCopies, ownImports] = await Promise.all([
    savedCopyIdsFor(viewer ?? "", recipes),
    ownImportIdsFor(viewer ?? "", recipes),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/discover"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Discover recipes
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-brand">
            <BookMarked className="h-4 w-4" /> Collection
          </p>
          <h1 className="mt-1 text-3xl">{data.collection.name}</h1>
          {data.collection.description && (
            <p className="mt-1 max-w-xl text-muted">{data.collection.description}</p>
          )}
          {byline && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
              {data.owner?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.owner.avatarUrl}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <CircleUserRound className="h-5 w-5" />
              )}
              Curated by {byline}
            </p>
          )}
        </div>
        {isOwner && (
          <Link href={`/collections/${data.collection.id}`}>
            <Button variant="secondary">Manage collection</Button>
          </Link>
        )}
      </div>

      {recipes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center text-muted">
          Nothing shared in this collection yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {recipes.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              href={`/r/${r.id}`}
              showFavorite={false}
              byline={byline ?? undefined}
              bylineAvatar={data.owner?.avatarUrl}
              bottomRightSlot={
                isOwner ? undefined : (
                  <SaveDropToggle
                    recipeId={r.id}
                    initialSaved={savedCopies.has(r.id)}
                    alreadyOwn={ownImports.has(r.id)}
                    signedIn={!!viewer}
                  />
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
