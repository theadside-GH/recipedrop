import Link from "next/link";
import type React from "react";
import { Flame, PlusCircle, Sparkles } from "lucide-react";
import { getOwnerEmail } from "@/lib/auth";
import { listPublicRecipes, listRecipes } from "@/lib/repo/recipes";
import { RecipeCard } from "@/components/recipe-card";
import { LibraryFilters } from "@/components/library-filters";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    meal?: string;
    max?: string;
    q?: string;
    tag?: string;
    favorite?: string;
    sort?: "newest" | "oldest" | "favorites" | "quickest" | "title";
  }>;
}) {
  const sp = await searchParams;
  const owner = await getOwnerEmail();
  let recipes;
  let newestPublic: Awaited<ReturnType<typeof listPublicRecipes>> = [];
  let popularPublic: Awaited<ReturnType<typeof listPublicRecipes>> = [];
  try {
    [recipes, newestPublic, popularPublic] = await Promise.all([
      listRecipes(owner, {
        mealType: sp.meal,
        maxMinutes: sp.max ? Number(sp.max) : undefined,
        search: sp.q,
        tag: sp.tag,
        favorite: sp.favorite === "1",
        sort: sp.sort,
      }),
      listPublicRecipes("newest", 4),
      listPublicRecipes("popular", 4),
    ]);
  } catch {
    return <DeploymentIssue />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your recipes</h1>
      <p className="mt-1 text-muted">
            {recipes.length} recipe{recipes.length === 1 ? "" : "s"} - search, sort & filter below
          </p>
        </div>
        <Link href="/import" className="hidden sm:block">
          <Button>
            <PlusCircle className="h-4 w-4" /> Import recipe
          </Button>
        </Link>
      </div>

      {!sp.meal && !sp.max && !sp.q && !sp.tag && !sp.favorite && (
        <PublicHomeSections newest={newestPublic} popular={popularPublic} />
      )}

      <LibraryFilters />

      {recipes.length === 0 ? (
        <EmptyState hasAny={!sp.meal && !sp.max && !sp.q && !sp.tag} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {recipes.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function PublicHomeSections({
  newest,
  popular,
}: {
  newest: Awaited<ReturnType<typeof listPublicRecipes>>;
  popular: Awaited<ReturnType<typeof listPublicRecipes>>;
}) {
  if (newest.length === 0 && popular.length === 0) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <MiniPublicSection title="Newest drops" icon={Sparkles} recipes={newest} />
      <MiniPublicSection title="Most dropped" icon={Flame} recipes={popular} />
    </div>
  );
}

function MiniPublicSection({
  title,
  icon: Icon,
  recipes,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  recipes: Awaited<ReturnType<typeof listPublicRecipes>>;
}) {
  if (recipes.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-brand" />
          {title}
        </h2>
        <Link href="/discover" className="text-xs font-medium text-brand hover:underline">
          See all
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {recipes.slice(0, 2).map((row) => (
          <RecipeCard
            key={row.recipe.id}
            recipe={row.recipe}
            href={`/r/${row.recipe.id}`}
            showFavorite={false}
            byline={row.handle ? `@${row.handle}` : row.displayName}
            bylineAvatar={row.avatarUrl}
          />
        ))}
      </div>
    </section>
  );
}

function DeploymentIssue() {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border bg-surface p-6">
      <h1 className="text-xl font-semibold">RecipeDrop needs one deployment setting fixed</h1>
      <p className="mt-2 text-sm text-muted">
        The app is online, but it cannot reach its recipe database from this Vercel project.
      </p>
      <div className="mt-4 rounded-md bg-background p-4 text-sm">
        Check that <strong>DATABASE_URL</strong> is set on this exact Vercel project, then
        redeploy.
      </div>
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Sparkles className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">
        {hasAny ? "No recipes yet" : "No matches for these filters"}
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        {hasAny
          ? "Import your first recipe from a link, a photo, pasted text, or a YouTube video - RecipeDrop will turn it into clean, step-by-step instructions."
          : "Try clearing a filter or searching for something else."}
      </p>
      {hasAny && (
        <Link href="/import" className="mt-5">
          <Button>
            <PlusCircle className="h-4 w-4" /> Import a recipe
          </Button>
        </Link>
      )}
    </div>
  );
}
