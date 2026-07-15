import Link from "next/link";
import { BookMarked, Dices, PenLine, PlusCircle, Sparkles } from "lucide-react";
import { getOwnerEmail } from "@/lib/auth";
import { collectionIdsByRecipe, listCollections } from "@/lib/repo/collections";
import { cookedCountsForOwner } from "@/lib/repo/notes";
import { listRecipes } from "@/lib/repo/recipes";
import { CollectionQuickAdd } from "@/components/collection-picker";
import { FavoriteButton } from "@/components/favorite-button";
import { MadeItButton } from "@/components/made-it-button";
import { RecipeCard } from "@/components/recipe-card";
import { LibraryFilters } from "@/components/library-filters";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your Recipes" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    meal?: string;
    max?: string;
    q?: string;
    tag?: string;
    favorite?: string;
    made?: string;
    origin?: string;
    sort?: "newest" | "oldest" | "favorites" | "quickest" | "title";
  }>;
}) {
  const sp = await searchParams;
  const owner = await getOwnerEmail();
  let recipes;
  let cookedCounts: Map<string, number>;
  let collections: Awaited<ReturnType<typeof listCollections>>;
  let memberships: Map<string, string[]>;
  try {
    recipes = await listRecipes(owner, {
      mealType: sp.meal,
      maxMinutes: sp.max ? Number(sp.max) : undefined,
      search: sp.q,
      tag: sp.tag,
      favorite: sp.favorite === "1",
      made: sp.made === "1",
      origin: sp.origin === "own" || sp.origin === "saved" ? sp.origin : undefined,
      sort: sp.sort,
    });
    [cookedCounts, collections, memberships] = await Promise.all([
      cookedCountsForOwner(owner, recipes.map((r) => r.id)),
      listCollections(owner),
      collectionIdsByRecipe(owner, recipes.map((r) => r.id)),
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
        <div className="hidden items-center gap-2 sm:flex">
          <Link href="/collections" title="Your collections">
            <Button variant="secondary">
              <BookMarked className="h-4 w-4" /> Collections
            </Button>
          </Link>
          {recipes.length > 1 && (
            <Link href="/recipes/surprise" prefetch={false} title="Open a random recipe">
              <Button variant="secondary">
                <Dices className="h-4 w-4" /> Surprise me
              </Button>
            </Link>
          )}
          <Link href="/recipes/new" title="Write a recipe by hand">
            <Button variant="secondary">
              <PenLine className="h-4 w-4" /> New recipe
            </Button>
          </Link>
          <Link href="/import">
            <Button>
              <PlusCircle className="h-4 w-4" /> Import recipe
            </Button>
          </Link>
        </div>
      </div>

      {/* Same actions for phones — the header row above is desktop-only. */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:hidden">
        <Link href="/import" className="shrink-0">
          <Button size="sm">
            <PlusCircle className="h-4 w-4" /> Import
          </Button>
        </Link>
        <Link href="/recipes/new" className="shrink-0">
          <Button variant="secondary" size="sm">
            <PenLine className="h-4 w-4" /> New recipe
          </Button>
        </Link>
        <Link href="/collections" className="shrink-0">
          <Button variant="secondary" size="sm">
            <BookMarked className="h-4 w-4" /> Collections
          </Button>
        </Link>
        {recipes.length > 1 && (
          <Link href="/recipes/surprise" prefetch={false} className="shrink-0">
            <Button variant="secondary" size="sm">
              <Dices className="h-4 w-4" /> Surprise me
            </Button>
          </Link>
        )}
      </div>

      <LibraryFilters />

      {recipes.length === 0 ? (
        <EmptyState
          hasAny={
            !sp.meal && !sp.max && !sp.q && !sp.tag && !sp.favorite && !sp.made && !sp.origin
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {recipes.map((r) => {
            const inIds = new Set(memberships.get(r.id) ?? []);
            return (
              <RecipeCard
                key={r.id}
                recipe={r}
                actionsRow={
                  <>
                    <FavoriteButton recipeId={r.id} initialFavorite={r.isFavorite} />
                    <CollectionQuickAdd
                      recipeId={r.id}
                      collections={collections.map((c) => ({
                        id: c.id,
                        name: c.name,
                        has: inIds.has(c.id),
                      }))}
                    />
                    <MadeItButton recipeId={r.id} initialCount={cookedCounts.get(r.id) ?? 0} />
                  </>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeploymentIssue() {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border bg-surface p-6">
      <h1 className="text-xl font-semibold">DishCovered needs one deployment setting fixed</h1>
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
          ? "Import your first recipe from a link, a photo, pasted text, or a YouTube video - DishCovered will turn it into clean, step-by-step instructions."
          : "Try clearing a filter or searching for something else."}
      </p>
      {hasAny && (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/import">
            <Button>
              <PlusCircle className="h-4 w-4" /> Import a recipe
            </Button>
          </Link>
          <Link href="/recipes/new">
            <Button variant="secondary">
              <PenLine className="h-4 w-4" /> Write one yourself
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
