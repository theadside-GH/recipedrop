"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBasket,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { RecipeImage } from "@/components/recipe-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatMinutes } from "@/lib/utils";
import {
  addShoppingItemAction,
  addToPlanAction,
  generateListAction,
  removePlanItemAction,
  setServingsAction,
} from "@/app/actions";
import { ShoppingListView, type ShoppingItem } from "./shopping-list-view";

interface PlanItem {
  id: string;
  recipeId: string;
  title: string;
  imagePath: string | null;
  mealType: string;
  totalMinutes: number | null;
  servingsDefault: number;
  plannedServings: number;
}

interface PickRecipe {
  id: string;
  title: string;
  imagePath: string | null;
  mealType: string;
  servingsDefault: number;
}

export function PlanEditor({
  planId,
  planName,
  items,
  allRecipes,
  shopping,
}: {
  planId: string;
  planName: string;
  items: PlanItem[];
  allRecipes: PickRecipe[];
  shopping: { items: ShoppingItem[] } | null;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);

  const inPlan = new Set(items.map((i) => i.recipeId));
  const available = allRecipes.filter(
    (r) => !inPlan.has(r.id) && r.title.toLowerCase().includes(query.toLowerCase()),
  );

  function refresh() {
    startTransition(() => router.refresh());
  }

  function changeServings(itemId: string, servings: number) {
    if (servings < 1) return;
    startTransition(async () => {
      await setServingsAction(planId, itemId, servings);
      router.refresh();
    });
  }

  function remove(itemId: string) {
    startTransition(async () => {
      await removePlanItemAction(planId, itemId);
      router.refresh();
    });
  }

  function add(r: PickRecipe) {
    startTransition(async () => {
      await addToPlanAction(planId, r.id, r.servingsDefault);
      router.refresh();
    });
  }

  async function generate() {
    setGenerating(true);
    try {
      await generateListAction(planId);
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{planName}</h1>
        <p className="mt-1 text-muted">
          {items.length} recipe{items.length === 1 ? "" : "s"} -{" "}
          {items.reduce((n, i) => n + i.plannedServings, 0)} servings total
        </p>
      </div>

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <Thumb src={item.imagePath} meal={item.mealType} title={item.title} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.title}</p>
                <p className="text-xs text-muted">
                  {formatMinutes(item.totalMinutes)} - recipe serves {item.servingsDefault}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted" />
                <Stepper
                  value={item.plannedServings}
                  onChange={(v) => changeServings(item.id, v)}
                />
              </div>
              <button
                onClick={() => remove(item.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-red-50 hover:text-red-500"
                aria-label="Remove from list"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card">
        <button
          onClick={() => setPicking((v) => !v)}
          className="flex w-full items-center gap-2 p-4 font-medium"
        >
          <Plus className="h-5 w-5 text-brand" /> Add recipes
        </button>
        {picking && (
          <div className="space-y-2 border-t border-border p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your recipes..."
                className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm focus:border-brand focus-visible:outline-none"
              />
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {available.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">
                  No more recipes to add.
                </p>
              ) : (
                available.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => add(r)}
                    disabled={isPending}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface"
                  >
                    <Thumb src={r.imagePath} meal={r.mealType} title={r.title} small />
                    <span className="flex-1 truncate text-sm font-medium">{r.title}</span>
                    <Badge variant="brand" className="capitalize">
                      {r.mealType}
                    </Badge>
                    <Plus className="h-4 w-4 text-brand" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <Button onClick={generate} size="lg" className="w-full" disabled={generating}>
          {generating ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ShoppingBasket className="h-5 w-5" />
          )}
          {shopping ? "Regenerate shopping list" : "Generate shopping list"}
        </Button>
      )}

      <AddCustomItem planId={planId} onAdded={refresh} />

      {shopping && shopping.items.length > 0 && (
        <ShoppingListView planId={planId} items={shopping.items} onChanged={refresh} />
      )}

      {items.length === 0 && (!shopping || shopping.items.length === 0) && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <Sparkles className="h-7 w-7 text-brand" />
          <p className="mt-3 font-medium">Two ways to fill this list</p>
          <p className="text-sm text-muted">
            Add recipes above and generate a consolidated shopping list — or skip recipes
            and just type in what you need.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Free-text shopping items, independent of any recipe. This is what makes a
 * from-scratch list possible; typed items also survive regeneration.
 */
function AddCustomItem({ planId, onAdded }: { planId: string; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = name.trim();
    if (!cleaned) return;
    setError(null);
    startTransition(async () => {
      try {
        await addShoppingItemAction(planId, cleaned);
        setName("");
        onAdded();
      } catch (err) {
        // e.g. the item is already on the list — say so instead of silently
        // clearing the field.
        setError(err instanceof Error ? err.message : "That didn't add. Try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3"
      >
        <Plus className="ml-1 h-5 w-5 shrink-0 text-brand" />
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="Add anything to the list — paper towels, coffee, batteries..."
          aria-label="Add your own shopping item"
          className="h-10 w-full min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm focus:border-brand focus-visible:outline-none"
        />
        <Button type="submit" variant="secondary" disabled={isPending || !name.trim()}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </Button>
      </form>
      {error && <p className="px-2 text-sm text-muted">{error}</p>}
    </div>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(value - 1)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface hover:bg-brand-soft"
        aria-label="Fewer servings"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-5 text-center text-sm font-semibold">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface hover:bg-brand-soft"
        aria-label="More servings"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Thumb({
  src,
  meal,
  title,
  small,
}: {
  src: string | null;
  meal: string;
  title: string;
  small?: boolean;
}) {
  const size = small ? "h-10 w-10" : "h-14 w-14";
  return (
    <div className={cn("shrink-0 overflow-hidden rounded-xl bg-surface", size)}>
      <RecipeImage src={src} title={title} mealType={meal} />
    </div>
  );
}
