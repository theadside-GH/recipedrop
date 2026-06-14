import Link from "next/link";
import { PlusCircle, Sparkles } from "lucide-react";
import { getOwnerEmail } from "@/lib/auth";
import { listRecipes } from "@/lib/repo/recipes";
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
  try {
    recipes = await listRecipes(owner, {
      mealType: sp.meal,
      maxMinutes: sp.max ? Number(sp.max) : undefined,
      search: sp.q,
      tag: sp.tag,
      favorite: sp.favorite === "1",
      sort: sp.sort,
    });
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
