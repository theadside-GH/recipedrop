import Link from "next/link";
import type React from "react";
import { ArrowRight, Compass, Crown, Flame, LayoutGrid, Search, Sparkles, Users } from "lucide-react";
import { RecipeCard } from "@/components/recipe-card";
import { SaveDropToggle } from "@/components/save-drop-toggle";
import { CollectionQuickAdd } from "@/components/collection-picker";
import { FavoriteButton } from "@/components/favorite-button";
import { MadeItButton } from "@/components/made-it-button";
import { MadeThisButton } from "@/components/social-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getViewerEmail } from "@/lib/auth";
import { TIERS } from "@/lib/entitlements";
import { collectionIdsByRecipe, listCollections } from "@/lib/repo/collections";
import { cookedCountsForOwner } from "@/lib/repo/notes";
import {
  countPublicRecipes,
  listPublicRecipes,
  ownImportIdsFor,
  savedCopyIdsFor,
  type PublicRecipeRow,
} from "@/lib/repo/recipes";
import { cookedCountsFor, listFollowedRecipes, viewerCookedIdsFor } from "@/lib/repo/social";
import { cn } from "@/lib/utils";
import { ShareOnboardingCard } from "./share-onboarding-card";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dishcover" };

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

  const [newest, popular, followed, publicTotal] =
    filtering || viewAll
      ? [
          await listPublicRecipes(viewAll ? allSort : "newest", viewAll ? 300 : 24, {
            q,
            mealType: meal,
          }),
          [],
          [],
          await countPublicRecipes({ q, mealType: meal }),
        ]
      : await Promise.all([
          listPublicRecipes("newest", 12),
          listPublicRecipes("popular", 8),
          viewer ? listFollowedRecipes(viewer, 8) : Promise.resolve([]),
          Promise.resolve(0),
        ]);

  const allRows = [...newest, ...popular, ...followed];
  const ownIds = allRows
    .filter((row) => row.recipe.ownerEmail === viewer)
    .map((row) => row.recipe.id);
  const [cookedCounts, savedCopies, ownImports, viewerCooked, collections, memberships, ownMadeCounts] =
    await Promise.all([
      cookedCountsFor(allRows.map((row) => row.recipe.id)),
      savedCopyIdsFor(viewer, allRows.map((row) => row.recipe)),
      ownImportIdsFor(viewer, allRows.map((row) => row.recipe)),
      viewerCookedIdsFor(viewer, allRows.map((row) => row.recipe.id)),
      viewer ? listCollections(viewer) : Promise.resolve([]),
      viewer ? collectionIdsByRecipe(viewer, ownIds) : Promise.resolve(new Map<string, string[]>()),
      viewer ? cookedCountsForOwner(viewer, ownIds) : Promise.resolve(new Map<string, number>()),
    ]);

  // The same action icons in the same spot as Your Recipes cards: your own
  // dishcovery gets the library row, everyone else's gets save + made-this.
  const actionsFor = (row: PublicRecipeRow) =>
    row.recipe.ownerEmail === viewer ? (
      <>
        <FavoriteButton recipeId={row.recipe.id} initialFavorite={row.recipe.isFavorite} />
        <CollectionQuickAdd
          recipeId={row.recipe.id}
          collections={collections.map((c) => ({
            id: c.id,
            name: c.name,
            has: (memberships.get(row.recipe.id) ?? []).includes(c.id),
          }))}
        />
        <MadeItButton
          recipeId={row.recipe.id}
          initialCount={ownMadeCounts.get(row.recipe.id) ?? 0}
        />
      </>
    ) : (
      <>
        <SaveDropToggle
          recipeId={row.recipe.id}
          initialSaved={savedCopies.has(row.recipe.id)}
          alreadyOwn={ownImports.has(row.recipe.id)}
          signedIn={!!viewer}
        />
        <MadeThisButton
          iconOnly
          recipeId={row.recipe.id}
          initialCooked={viewerCooked.has(row.recipe.id)}
          initialCount={cookedCounts.get(row.recipe.id) ?? 0}
          signedIn={!!viewer}
        />
      </>
    );

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand-soft via-background to-background p-6 sm:p-9">
        <Compass
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rotate-12 text-brand opacity-[0.07]"
        />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <h1 className="text-3xl sm:text-4xl">Dishcover your next favorite dish</h1>
            <p className="mt-2 text-muted">
              Dishcoveries — public recipes shared by fellow dishcoverers. Tap the little
              recipe book on a card to save it to Your Recipes — tap again to un-save.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/discover?view=all">
              <Button variant={viewAll ? "primary" : "secondary"}>
                <LayoutGrid className="h-4 w-4" />
                Browse all dishcoveries
              </Button>
            </Link>
            <Link href="/pro">
              <Button variant="secondary">
                <Crown className="h-4 w-4 text-brand" />
                Free &amp; Pro plans
              </Button>
            </Link>
            {viewer && (
              <Link href="/profile">
                <Button variant="secondary">
                  <Compass className="h-4 w-4" />
                  Public settings
                </Button>
              </Link>
            )}
          </div>
        </div>

        <form action="/discover" className="relative mt-5 max-w-xl">
          {meal && <input type="hidden" name="meal" value={meal} />}
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search dishcoveries - dish, ingredient, or tag..."
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
              ? `All dishcoveries (${publicTotal})`
              : q
                ? `Results for "${q}" (${publicTotal})`
                : `${capitalize(meal)} dishcoveries (${publicTotal})`
          }
          description={
            viewAll
              ? `Every publicly shared dish.${
                  newest.length < publicTotal ? ` Showing the newest ${newest.length}.` : ""
                } When several dishcoverers share the same link, it appears once — the card credits whoever Dishcovered it first and counts everyone. Private recipes stay in Your Recipes.`
              : undefined
          }
          icon={viewAll ? LayoutGrid : Search}
          recipes={newest}
          viewer={viewer}
          cookedCounts={cookedCounts}
          actions={actionsFor}
          empty={
            viewAll
              ? "No dishcoveries yet."
              : "No dishcoveries match. Try another dish, ingredient, or tag."
          }
          action={
            viewAll ? (
              <div className="flex gap-2">
                <SortChip label="Newest" icon={Sparkles} active={allSort === "newest"} href="/discover?view=all" />
                <SortChip label="Popular" icon={Flame} active={allSort === "popular"} href="/discover?view=all&sort=popular" />
              </div>
            ) : undefined
          }
        />
      ) : (
        <>
          {followed.length > 0 && (
            <PublicSection
              title="From dishcoverers you follow"
              icon={Users}
              recipes={followed}
              viewer={viewer}
              cookedCounts={cookedCounts}
              actions={actionsFor}
              empty=""
            />
          )}

          <PublicSection
            title="Newest dishcoveries"
            icon={Sparkles}
            recipes={newest}
            viewer={viewer}
            cookedCounts={cookedCounts}
            actions={actionsFor}
            empty="No dishcoveries yet."
            action={
              <Link
                href="/discover?view=all"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
              >
                See all dishcoveries <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />

          <PublicSection
            title="Popular dishcoveries"
            icon={Flame}
            recipes={popular}
            viewer={viewer}
            cookedCounts={cookedCounts}
            actions={actionsFor}
            empty="Popular dishcoveries will appear here once sharing grows."
            action={
              <Link
                href="/discover?view=all&sort=popular"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
              >
                See all by popularity <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />

          <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-6 sm:p-7">
            <div className="max-w-xl">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Crown className="h-5 w-5 text-brand" />
                Free to cook. Pro for import sprees.
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                The free plan is the full app — your recipe library, meal plans, one smart
                shopping list, and {TIERS.free.aiUsesPerDay} AI imports every day. Pro
                raises that to {TIERS.pro.aiUsesPerDay} a day and removes the caps on
                photo imports, plans, and collections.
              </p>
            </div>
            <Link href="/pro">
              <Button size="lg">
                Why subscribe <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </section>
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
  description,
  icon: Icon,
  recipes,
  viewer,
  cookedCounts,
  actions,
  empty,
  action,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  recipes: PublicRecipeRow[];
  viewer: string;
  cookedCounts: Map<string, number>;
  /** Per-card action icons for the row under the photo. */
  actions: (row: PublicRecipeRow) => React.ReactNode;
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
      {description && <p className="max-w-2xl text-sm text-muted">{description}</p>}
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
              // Your own dishcovery opens your recipe page directly — the same
              // page a click from Your Recipes lands on (/r redirects anyway).
              href={
                row.recipe.ownerEmail === viewer
                  ? `/recipes/${row.recipe.id}`
                  : `/r/${row.recipe.id}`
              }
              byline={row.handle ? `@${row.handle}` : row.displayName}
              bylineAvatar={row.avatarUrl}
              bylineHref={row.handle ? `/u/${row.handle}` : undefined}
              cookedCount={cookedCounts.get(row.recipe.id)}
              dropperCount={row.dropperCount}
              topRightSlot={
                row.recipe.ownerEmail === viewer ? (
                  <Badge variant="solid">Your dishcovery</Badge>
                ) : undefined
              }
              actionsRow={actions(row)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
