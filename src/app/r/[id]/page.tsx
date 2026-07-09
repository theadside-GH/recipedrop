import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getViewerEmail } from "@/lib/auth";
import { getRecipeFull } from "@/lib/repo/recipes";
import { getCookedState, isFollowingOwnerOfRecipe } from "@/lib/repo/social";
import { RecipeDetail } from "@/components/recipe-detail";
import { SaveDropButton } from "@/components/save-drop-button";
import { FollowButton, MadeThisButton } from "@/components/social-buttons";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PublicRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, viewer] = await Promise.all([getRecipeFull(id), getViewerEmail()]);
  if (!data || !data.recipe.isPublic) notFound();
  const isOwner = data.recipe.ownerEmail === viewer;
  const [following, cookedState] = await Promise.all([
    isOwner || !viewer ? Promise.resolve(false) : isFollowingOwnerOfRecipe(viewer, id),
    getCookedState(viewer ?? "", id),
  ]);
  const cookName = data.dropper?.handle ? `@${data.dropper.handle}` : data.dropper?.displayName;

  return (
    <div className="space-y-5">
      <Link
        href="/discover"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Discover recipes
      </Link>
      <RecipeDetail
        // RecipeDetail is a client component: blank the owner's email so it
        // never ships in the page payload of a public drop.
        recipe={{ ...data.recipe, ownerEmail: "" }}
        ingredients={data.ingredients}
        steps={data.steps}
        tags={data.tags}
        dropperName={cookName}
        dropperAvatar={data.dropper?.avatarUrl}
        readOnly
        actionsSlot={
          isOwner ? (
            <Link href={`/recipes/${data.recipe.id}`}>
              <Button size="lg">Open in Your Recipes</Button>
            </Link>
          ) : (
            <>
              <SaveDropButton recipeId={data.recipe.id} />
              <MadeThisButton
                recipeId={data.recipe.id}
                initialCooked={cookedState.viewerCooked}
                initialCount={cookedState.cookedCount}
              />
              <FollowButton
                recipeId={data.recipe.id}
                initialFollowing={following}
                cookName={cookName}
              />
            </>
          )
        }
      />
    </div>
  );
}
