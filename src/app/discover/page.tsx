import Link from "next/link";
import type React from "react";
import { Compass, Flame, Sparkles } from "lucide-react";
import { RecipeCard } from "@/components/recipe-card";
import { Button } from "@/components/ui/button";
import { listPublicRecipes } from "@/lib/repo/recipes";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const [newest, popular] = await Promise.all([
    listPublicRecipes("newest", 12),
    listPublicRecipes("popular", 8),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Discover drops</h1>
          <p className="mt-1 text-muted">
            Public recipes from people who choose to share their drops.
          </p>
        </div>
        <Link href="/profile">
          <Button variant="secondary">
            <Compass className="h-4 w-4" />
            Public settings
          </Button>
        </Link>
      </div>

      <PublicSection
        title="Newest drops"
        icon={Sparkles}
        recipes={newest}
        empty="No public drops yet."
      />

      <PublicSection
        title="Most dropped"
        icon={Flame}
        recipes={popular}
        empty="Most-dropped recipes will appear here once public sharing grows."
      />
    </div>
  );
}

function PublicSection({
  title,
  icon: Icon,
  recipes,
  empty,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  recipes: Awaited<ReturnType<typeof listPublicRecipes>>;
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Icon className="h-5 w-5 text-brand" />
        {title}
      </h2>
      {recipes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
          {empty}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {recipes.map((row) => (
            <RecipeCard
              key={row.recipe.id}
              recipe={row.recipe}
              showFavorite={false}
              byline={row.handle ? `@${row.handle}` : row.displayName}
            />
          ))}
        </div>
      )}
    </section>
  );
}
