import Link from "next/link";
import type React from "react";
import { Compass, Flame, Sparkles } from "lucide-react";
import { RecipeCard } from "@/components/recipe-card";
import { SaveDropButton } from "@/components/save-drop-button";
import { Button } from "@/components/ui/button";
import { getOwnerEmail } from "@/lib/auth";
import { listPublicRecipes } from "@/lib/repo/recipes";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const [newest, popular, viewer] = await Promise.all([
    listPublicRecipes("newest", 12),
    listPublicRecipes("popular", 8),
    getOwnerEmail(),
  ]);

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand-soft via-background to-background p-6 sm:p-9">
        <Compass
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rotate-12 text-brand opacity-[0.07]"
        />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <h1 className="text-3xl sm:text-4xl">Discover drops</h1>
            <p className="mt-2 text-muted">
              Public recipes from people who choose to share their drops. Tap the bookmark to
              save one straight to Your Recipes.
            </p>
          </div>
          <Link href="/profile">
            <Button variant="secondary">
              <Compass className="h-4 w-4" />
              Public settings
            </Button>
          </Link>
        </div>
      </div>

      <PublicSection
        title="Newest drops"
        icon={Sparkles}
        recipes={newest}
        viewer={viewer}
        empty="No public drops yet."
      />

      <PublicSection
        title="Most dropped"
        icon={Flame}
        recipes={popular}
        viewer={viewer}
        empty="Most-dropped recipes will appear here once public sharing grows."
      />
    </div>
  );
}

function PublicSection({
  title,
  icon: Icon,
  recipes,
  viewer,
  empty,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  recipes: Awaited<ReturnType<typeof listPublicRecipes>>;
  viewer: string;
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
              href={`/r/${row.recipe.id}`}
              showFavorite={false}
              byline={row.handle ? `@${row.handle}` : row.displayName}
              bylineAvatar={row.avatarUrl}
              topRightSlot={
                row.recipe.ownerEmail === viewer ? undefined : (
                  <SaveDropButton compact recipeId={row.recipe.id} />
                )
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
