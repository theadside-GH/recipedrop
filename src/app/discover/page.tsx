import Link from "next/link";
import type React from "react";
import { ArrowRight, Compass, Flame, LayoutGrid, Search, Sparkles, Users } from "lucide-react";
import { RecipeCard } from "@/components/recipe-card";
import { SaveDropToggle } from "@/components/save-drop-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getViewerEmail } from "@/lib/auth";
import { listPublicRecipes, savedCopyIdsFor, type PublicRecipeRow } from "@/lib/repo/recipes";
import { cookedCountsFor, listFollowedRecipes } from "@/lib/repo/social";
import { cn } from "@/lib/utils";
import { ShareOnboardingCard } from "./share-onboarding-card";

export const dynamic = "force-dynamic";

const MEALS = ["breakfast", "lunch", "dinner", "snack", "dessert", "side", "drink"];

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; meal?: string; view?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const meal = MEALS.includes(sp.meal ?? "") ? (sp.meal as string) : "";
  const filtering = !!(q || meal);
  const viewAll = sp.view === "all" && !filtering;
  const allSort = sp.sort === "popular" ? ("popular" as const) : ("newest" as const);
  const viewer = (await getViewerEmail()) ?? "";

  const [newest, popular, followed] =
    filtering || viewAll
      ? [
          await listPublicRecipes(viewAll ? allSort : "newest", viewAll ? 300 : 24, {
            q,
            mealType: meal,
          }),
          [],
          [],
        ]
      : await Promise.all([
          listPublicRecipes("newest", 12),
          listPublicRecipes("popular", 8),
          viewer ? listFollowedRecipes(viewer, 8) : Promise.resolve([]),
        ]);

  const allRows = [...newest, ...popular, ...followed];
  const [cookedCounts, savedCopies] = await Promise.all([
    cookedCountsFor(allRows.map((row) => row.recipe.id)),
    savedCopyIdsFor(viewer, allRows.map((row) => row.recipe)),
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
              Public recipes from people who choose to share their drops. Tap the little
              recipe book on a photo to save it to Your Recipes — tap again to un-save.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/discover?view=all">
              <Button variant={viewAll ? "primary" : "secondary"}>
                <LayoutGrid className="h-4 w-4" />
                Browse all drops
              </Button>
            </Link>
            <Link href="/profile">
              <Button variant="secondary">
                <Compass className="h-4 w-4" />
                Public settings
              </Button>
            </Link>
          </div>
        </div>

        <form action="/discover" className="relative mt-5 max-w-xl">
          {meal && <input type="hidden" name="meal" value={meal} />}
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search public drops - dish, ingredient, or tag..."
            className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm focus:border-brand focus-visible:outline-none"
          />
        </form>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          <MealChip label="All" active={!meal} href={discoverHref("", q)} />
          {MEALS.map((m) => (
            <MealChip
              key={m}
              label={m}
              active={meal === m}
              href={discoverHref(meal === m ? "" : m, q)}
            />
          ))}
        </div>
      </div>

      {viewer && <ShareOnboardingCard />}

      {filtering || viewAll ? (
        <PublicSection
          title={
            viewAll
              ? `All drops (${newest.length})`
              : q
                ? `Results for "${q}"`
                : `${capitalize(meal)} drops`
          }
          icon={viewAll ? LayoutGrid : Search}
          recipes={newest}
          viewer={viewer}
          cookedCounts={cookedCounts}
          savedCopies={savedCopies}
          empty={
            viewAll
              ? "No public drops yet."
              : "No public drops match. Try another dish, ingredient, or tag."
          }
          action={
            viewAll ? (
              <div className="flex gap-2">
                <SortChip label="Newest" icon={Sparkles} active={allSort === "newest"} href="/discover?view=all" />
                <SortChip label="Most dropped" icon={Flame} active={allSort === "popular"} href="/discover?view=all&sort=popular" />
              </div>
            ) : undefined
          }
        />
      ) : (
        <>
          {followed.length > 0 && (
            <PublicSection
              title="From cooks you follow"
              icon={Users}
              recipes={followed}
              viewer={viewer}
              cookedCounts={cookedCounts}
              savedCopies={savedCopies}
              empty=""
            />
          )}

          <PublicSection
            title="Newest drops"
            icon={Sparkles}
            recipes={newest}
            viewer={viewer}
            cookedCounts={cookedCounts}
            savedCopies={savedCopies}
            empty="No public drops yet."
            action={
              <Link
                href="/discover?view=all"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
              >
                See all drops <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />

          <PublicSection
            title="Most dropped"
            icon={Flame}
            recipes={popular}
            viewer={viewer}
            cookedCounts={cookedCounts}
            savedCopies={savedCopies}
            empty="Most-dropped recipes will appear here once public sharing grows."
            action={
              <Link
                href="/discover?view=all&sort=popular"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
              >
                See all by most dropped <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
        </>
      )}
    </div>
  );
}

function discoverHref(meal: string, q: string): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (meal) params.set("meal", meal);
  const query = params.toString();
  return query ? `/discover?${query}` : "/discover";
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function MealChip({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-4 py-1.5 text-sm font-medium capitalize transition-colors",
        active
          ? "border-brand bg-brand text-brand-foreground"
          : "border-border bg-card text-foreground hover:bg-surface",
      )}
    >
      {label}
    </Link>
  );
}

function SortChip({
  label,
  icon: Icon,
  active,
  href,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-brand bg-brand text-brand-foreground"
          : "border-border bg-card text-foreground hover:bg-surface",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

function PublicSection({
  title,
  icon: Icon,
  recipes,
  viewer,
  cookedCounts,
  savedCopies,
  empty,
  action,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  recipes: PublicRecipeRow[];
  viewer: string;
  cookedCounts: Map<string, number>;
  savedCopies: Map<string, string>;
  empty: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Icon className="h-5 w-5 text-brand" />
          {title}
        </h2>
        {action}
      </div>
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
              bylineHref={row.handle ? `/u/${row.handle}` : undefined}
              cookedCount={cookedCounts.get(row.recipe.id)}
              dropperCount={row.dropperCount}
              topRightSlot={
                row.recipe.ownerEmail === viewer ? (
                  <Badge variant="solid">Your drop</Badge>
                ) : undefined
              }
              bottomRightSlot={
                row.recipe.ownerEmail === viewer ? undefined : (
                  <SaveDropToggle
                    recipeId={row.recipe.id}
                    initialSaved={savedCopies.has(row.recipe.id)}
                  />
                )
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
