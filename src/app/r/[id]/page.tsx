import { cache } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getViewerEmail } from "@/lib/auth";
import { dropperCountForRecipe, getRecipeFull, savedCopyIdsFor } from "@/lib/repo/recipes";
import { listCollectionIdsForRecipe, listCollections } from "@/lib/repo/collections";
import { listRecipeComments } from "@/lib/repo/comments";
import { getCookedState, isFollowingOwnerOfRecipe } from "@/lib/repo/social";
import { CollectionPicker } from "@/components/collection-picker";
import { RecipeComments } from "@/components/recipe-comments";
import { RecipeDetail } from "@/components/recipe-detail";
import { ReportDropButton } from "@/components/report-drop-button";
import { SaveDropButton } from "@/components/save-drop-button";
import { FollowButton, MadeThisButton } from "@/components/social-buttons";

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
  // Your own dishcovery always opens as your recipe page — same page whether
  // you arrive from Dishcover or Your Recipes.
  if (isOwner) redirect(`/recipes/${id}`);
  // Moderation-hidden drops stay reachable for their owner only.
  if (data.recipe.isHidden) notFound();
  const [following, cookedState, dropperCount, collections, memberIds, comments] =
    await Promise.all([
      viewer ? isFollowingOwnerOfRecipe(viewer, id) : Promise.resolve(false),
      getCookedState(viewer ?? "", id),
      dropperCountForRecipe(data.recipe),
      viewer ? listCollections(viewer) : Promise.resolve([]),
      viewer
        ? savedCopyIdsFor(viewer, [data.recipe]).then((copies) => {
            const copyId = copies.get(id);
            return copyId ? listCollectionIdsForRecipe(viewer, copyId) : [];
          })
        : Promise.resolve([]),
      listRecipeComments(id, viewer),
    ]);
  const inCollections = new Set(memberIds);
  const cookName = data.dropper?.handle ? `@${data.dropper.handle}` : data.dropper?.displayName;

  return (
    <div className="space-y-5">
      <Link
        href="/discover"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Dishcover recipes
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
          <>
            <SaveDropButton recipeId={data.recipe.id} signedIn={!!viewer} />
            {viewer && (
              <CollectionPicker
                recipeId={data.recipe.id}
                dropSource
                collections={collections.map((c) => ({
                  id: c.id,
                  name: c.name,
                  has: inCollections.has(c.id),
                }))}
              />
            )}
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
        }
      />
      <RecipeComments
        recipeId={data.recipe.id}
        signedIn={!!viewer}
        entries={comments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt.toISOString(),
          authorName: comment.authorName,
          authorHandle: comment.authorHandle,
          authorAvatar: comment.authorAvatar,
          mine: comment.mine,
        }))}
      />
      {viewer && (
        <div className="border-t border-border pt-4">
          <ReportDropButton recipeId={data.recipe.id} />
        </div>
      )}
    </div>
  );
}
