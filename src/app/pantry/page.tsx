import Link from "next/link";
import type React from "react";
import { Archive, ArrowRight, PackageCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { RecipeImage } from "@/components/recipe-image";
import { getOwnerEmail } from "@/lib/auth";
import { listPantryItems, listPantryRecipeSuggestions, pantryCounts } from "@/lib/repo/pantry";
import { cn } from "@/lib/utils";
import { CommonItemsPicker } from "./common-items-picker";
import { AddItemForm, RemovableItemChips } from "./pantry-controls";

export const dynamic = "force-dynamic";

export default async function PantryPage() {
  const owner = await getOwnerEmail();
  const [items, suggestions, counts] = await Promise.all([
    listPantryItems(owner),
    listPantryRecipeSuggestions(owner, 12),
    pantryCounts(owner),
  ]);
  const pantryItems = items.filter((item) => item.inPantry);
  const leftoverItems = items.filter((item) => item.hasLeftover);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pantry</h1>
          <p className="mt-1 text-muted">
            Mark shopping-list items you already have, or what is left over, then find recipes
            that use them.
          </p>
        </div>
        <Link href="/plans" className={buttonVariants({ variant: "secondary" })}>
          Meal plans
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <CommonItemsPicker selectedItems={pantryItems.map((item) => item.canonicalName)} />

      <div className="grid gap-4 md:grid-cols-2">
        <IngredientPanel
          title="In your pantry"
          icon={Archive}
          count={counts.pantry}
          items={pantryItems.map((item) => item.canonicalName)}
          empty="Type anything you have on hand, or check items off a shopping list."
          kind="pantry"
          addPlaceholder="Add anything you have - chicken thighs, kimchi..."
        />
        <IngredientPanel
          title="Left over"
          icon={PackageCheck}
          count={counts.leftovers}
          items={leftoverItems.map((item) => item.canonicalName)}
          empty="After shopping or cooking, mark extras as left over."
          kind="leftover"
          addPlaceholder="Add a leftover - half an onion, cooked rice..."
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="h-5 w-5 text-brand" />
            Recipe ideas from what you have
          </h2>
        </div>

        {suggestions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
            No matches yet. Add a few pantry or leftover items from a meal-plan shopping list and
            RecipeDrop will suggest saved recipes that use them.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {suggestions.map((suggestion) => (
              <SuggestionCard key={suggestion.recipe.id} suggestion={suggestion} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function IngredientPanel({
  title,
  icon: Icon,
  count,
  items,
  empty,
  kind,
  addPlaceholder,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  items: string[];
  empty: string;
  kind: "pantry" | "leftover";
  addPlaceholder: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Icon className="h-5 w-5 text-brand" />
          {title}
        </h2>
        <Badge variant="brand">{count}</Badge>
      </div>
      <AddItemForm kind={kind} placeholder={addPlaceholder} />
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <RemovableItemChips items={items} kind={kind} />
      )}
    </section>
  );
}

function SuggestionCard({
  suggestion,
}: {
  suggestion: Awaited<ReturnType<typeof listPantryRecipeSuggestions>>[number];
}) {
  const percent = Math.round((suggestion.matchCount / suggestion.totalCount) * 100);
  return (
    <Link
      href={`/recipes/${suggestion.recipe.id}`}
      className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="grid grid-cols-[112px,1fr] gap-0 sm:grid-cols-[144px,1fr]">
        <div className="aspect-square bg-surface">
          <RecipeImage
            src={suggestion.recipe.imagePath}
            title={suggestion.recipe.title}
            mealType={suggestion.recipe.mealType}
            imgClassName="transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="min-w-0 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={percent >= 60 ? "fresh" : "brand"}>{percent}% match</Badge>
            <span className="text-xs text-muted">
              {suggestion.matchCount}/{suggestion.totalCount} ingredients
            </span>
          </div>
          <h3 className="mt-2 line-clamp-2 font-semibold leading-snug">
            {suggestion.recipe.title}
          </h3>
          <IngredientLine label="Uses" names={suggestion.matchedNames} />
          <IngredientLine label="Missing" names={suggestion.missingNames} muted />
        </div>
      </div>
    </Link>
  );
}

function IngredientLine({
  label,
  names,
  muted = false,
}: {
  label: string;
  names: string[];
  muted?: boolean;
}) {
  const visible = names.slice(0, 4);
  if (visible.length === 0) return null;
  return (
    <p
      className={cn(
        "mt-2 line-clamp-2 text-xs capitalize",
        muted ? "text-muted" : "text-foreground",
      )}
    >
      <span className="font-semibold">{label}:</span> {visible.join(", ")}
      {names.length > visible.length ? ` +${names.length - visible.length}` : ""}
    </p>
  );
}
