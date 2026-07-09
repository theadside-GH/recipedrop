import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOwnerEmail } from "@/lib/auth";
import { getRecipeFull } from "@/lib/repo/recipes";
import { listCollectionIdsForRecipe, listCollections } from "@/lib/repo/collections";
import { RecipeDetail } from "@/components/recipe-detail";
import { CollectionPicker } from "@/components/collection-picker";

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

  const [collections, memberIds] = await Promise.all([
    listCollections(viewer),
    listCollectionIdsForRecipe(viewer, id),
  ]);
  const inCollections = new Set(memberIds);

  return (
    <div className="space-y-5">
      <Link
        href="/recipes"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All recipes
      </Link>
      <RecipeDetail
        recipe={data.recipe}
        ingredients={data.ingredients}
        steps={data.steps}
        tags={data.tags}
        dropperName={data.dropper?.handle ? `@${data.dropper.handle}` : data.dropper?.displayName}
        dropperAvatar={data.dropper?.avatarUrl}
        actionsSlot={
          <CollectionPicker
            recipeId={id}
            collections={collections.map((c) => ({
              id: c.id,
              name: c.name,
              has: inCollections.has(c.id),
            }))}
          />
        }
      />
    </div>
  );
}
