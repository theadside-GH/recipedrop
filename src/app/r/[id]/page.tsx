import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { getViewerEmail } from "@/lib/auth";
import { dropperCountForRecipe, getRecipeFull } from "@/lib/repo/recipes";
import { getCookedState, isFollowingOwnerOfRecipe } from "@/lib/repo/social";
import { RecipeDetail } from "@/components/recipe-detail";
import { ReportDropButton } from "@/components/report-drop-button";
import { SaveDropButton } from "@/components/save-drop-button";
import { FollowButton, MadeThisButton } from "@/components/social-buttons";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

// One fetch shared between generateMetadata and the page render.
const loadRecipe = cache(getRecipeFull);

/**
 * Real link previews: a shared recipe unfurls in chats with the dish name,
 * description, and photo instead of the generic site card.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await loadRecipe(id);
  if (!data || !data.recipe.isPublic || data.recipe.isHidden) return {};
  const { recipe } = data;
  const cook = data.dropper?.handle
    ? `@${data.dropper.handle}`
    : data.dropper?.displayName;
  const description =
    recipe.description ??
    `A recipe${cook ? ` Dishcovered by ${cook}` : ""} on DishCovered.`;
  const images = recipe.imagePath ? [`/api/og-image/${recipe.id}`] : undefined;
  return {
    title: recipe.title,
    description,
    openGraph: {
      title: recipe.title,
      description,
      type: "article",
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: recipe.title,
      description,
      images,
    },
  };
}

export default async function PublicRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, viewer] = await Promise.all([loadRecipe(id), getViewerEmail()]);
  if (!data || !data.recipe.isPublic) notFound();
  const isOwner = data.recipe.ownerEmail === viewer;
  // Moderation-hidden drops stay reachable for their owner only.
  if (data.recipe.isHidden && !isOwner) notFound();
  const [following, cookedState, dropperCount] = await Promise.all([
    isOwner || !viewer ? Promise.resolve(false) : isFollowingOwnerOfRecipe(viewer, id),
    getCookedState(viewer ?? "", id),
    dropperCountForRecipe(data.recipe),
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
        // RecipeDetail is a client component: blank the owner's email (and the
        // original dropper's, on saved copies) so no address ever ships in the
        // page payload of a public drop.
        recipe={{ ...data.recipe, ownerEmail: "", savedFromEmail: null }}
        ingredients={data.ingredients}
        steps={data.steps}
        tags={data.tags}
        dropperName={cookName}
        dropperAvatar={data.dropper?.avatarUrl}
        dropperHandle={data.dropper?.handle}
        dropperCount={dropperCount}
        readOnly
        actionsSlot={
          isOwner ? (
            <>
              <Link href={`/recipes/${data.recipe.id}/edit`}>
                <Button size="lg">
                  <Pencil className="h-4 w-4" /> Edit your recipe
                </Button>
              </Link>
              <span className="flex items-center rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted">
                This is the public view of your dishcovery — it already lives in Your Recipes.
              </span>
            </>
          ) : (
            <>
              <SaveDropButton recipeId={data.recipe.id} signedIn={!!viewer} />
              <MadeThisButton
                recipeId={data.recipe.id}
                initialCooked={cookedState.viewerCooked}
                initialCount={cookedState.cookedCount}
                signedIn={!!viewer}
              />
              <FollowButton
                recipeId={data.recipe.id}
                initialFollowing={following}
                cookName={cookName}
                signedIn={!!viewer}
              />
            </>
          )
        }
      />
      {viewer && !isOwner && (
        <div className="border-t border-border pt-4">
          <ReportDropButton recipeId={data.recipe.id} />
        </div>
      )}
    </div>
  );
}
