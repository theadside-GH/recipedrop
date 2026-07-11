import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, CircleUserRound, Users } from "lucide-react";
import { getViewerEmail } from "@/lib/auth";
import { listPublicRecipesByOwner, ownImportIdsFor, savedCopyIdsFor } from "@/lib/repo/recipes";
import { cookedCountsFor, getCookProfileByHandle, isFollowingHandle } from "@/lib/repo/social";
import { RecipeCard } from "@/components/recipe-card";
import { SaveDropToggle } from "@/components/save-drop-toggle";
import { FollowCookButton } from "@/components/social-buttons";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const profile = await getCookProfileByHandle(handle);
  if (!profile) return {};
  const title = `${profile.displayName} (@${profile.handle})`;
  const description =
    profile.bio ??
    `${profile.dropCount} dishcover${profile.dropCount === 1 ? "y" : "ies"} on DishCovered.`;
  return { title, description, openGraph: { title, description, type: "profile" } };
}

/** A dishcoverer's public page: who they are and every dish they've shared. */
export default async function CookPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const [profile, viewer] = await Promise.all([
    getCookProfileByHandle(handle),
    getViewerEmail(),
  ]);
  if (!profile) notFound();
  const isSelf = profile.email === viewer;

  const [recipes, following] = await Promise.all([
    listPublicRecipesByOwner(profile.email, 60),
    viewer && !isSelf ? isFollowingHandle(viewer, profile.handle) : Promise.resolve(false),
  ]);
  const [cookedCounts, savedCopies, ownImports] = await Promise.all([
    cookedCountsFor(recipes.map((row) => row.recipe.id)),
    savedCopyIdsFor(viewer ?? "", recipes.map((row) => row.recipe)),
    ownImportIdsFor(viewer ?? "", recipes.map((row) => row.recipe)),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/discover"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Discover recipes
      </Link>

      <div className="flex flex-wrap items-center gap-5 rounded-3xl border border-border bg-gradient-to-br from-brand-soft via-background to-background p-6 sm:p-8">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-soft text-brand">
            <CircleUserRound className="h-10 w-10" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{profile.displayName}</h1>
          <p className="text-muted">@{profile.handle}</p>
          {profile.bio && <p className="mt-2 max-w-xl text-sm text-muted">{profile.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              {profile.dropCount} dishcover{profile.dropCount === 1 ? "y" : "ies"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {profile.followerCount} follower{profile.followerCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {viewer && !isSelf && (
          <FollowCookButton handle={profile.handle} initialFollowing={following} />
        )}
        {isSelf && (
          <Link
            href="/profile"
            className="text-sm font-medium text-brand hover:underline"
          >
            Edit your public profile
          </Link>
        )}
      </div>

      {recipes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
          No dishcoveries yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {recipes.map((row) => (
            <RecipeCard
              key={row.recipe.id}
              recipe={row.recipe}
              href={`/r/${row.recipe.id}`}
              showFavorite={false}
              cookedCount={cookedCounts.get(row.recipe.id)}
              dropperCount={row.dropperCount}
              bottomRightSlot={
                isSelf ? undefined : (
                  <SaveDropToggle
                    recipeId={row.recipe.id}
                    initialSaved={savedCopies.has(row.recipe.id)}
                    alreadyOwn={ownImports.has(row.recipe.id)}
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
