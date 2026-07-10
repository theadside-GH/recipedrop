"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Clock,
  CircleUserRound,
  Minus,
  Plus,
  ChefHat,
  Trash2,
  ExternalLink,
  Users,
  Pencil,
  ImageIcon,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecipeImage } from "@/components/recipe-image";
import { PrintButton } from "@/components/print-button";
import { RecipePublicToggle } from "@/components/recipe-public-toggle";
import { ShareLinkButton } from "@/components/share-link-button";
import { cn, formatMinutes, tidyNumber } from "@/lib/utils";
import { pluralize } from "@/lib/shopping/units";
import { deleteRecipeAction, repairRecipeAction, repairRecipeImageAction } from "@/app/actions";
import type { Recipe, RecipeIngredient, Step } from "@/lib/db/schema";

export function RecipeDetail({
  recipe,
  ingredients,
  steps,
  tags,
  readOnly = false,
  dropperName,
  dropperAvatar,
  dropperCount,
  actionsSlot,
}: {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  steps: Step[];
  tags: string[];
  readOnly?: boolean;
  dropperName?: string | null;
  dropperAvatar?: string | null;
  /** People who dropped this dish; credited next to the dropper when > 1. */
  dropperCount?: number;
  /** Extra actions (e.g. "Save to Your Recipes" on public pages). */
  actionsSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const [servings, setServings] = useState(recipe.servingsDefault);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [isPublic, setIsPublic] = useState(recipe.isPublic);
  const [isPending, startTransition] = useTransition();
  const [repairPending, startRepairTransition] = useTransition();
  const [repairMessage, setRepairMessage] = useState<string | null>(null);
  const factor = recipe.servingsDefault > 0 ? servings / recipe.servingsDefault : 1;
  const couldUseHelp =
    !recipe.imagePath ||
    !recipe.description ||
    ingredients.length < 3 ||
    steps.length < 2 ||
    /^unknown recipe|^tiktok recipe|^instagram recipe/i.test(recipe.title);

  function handleDelete() {
    if (!confirm("Delete this recipe?")) return;
    startTransition(async () => {
      await deleteRecipeAction(recipe.id);
      router.push("/recipes");
    });
  }

  function handleRepair() {
    if (!recipe.sourceUrl) return;
    setRepairMessage(null);
    startRepairTransition(async () => {
      try {
        const result = await repairRecipeAction(recipe.id);
        setRepairMessage(result.message);
        if (result.ok) router.refresh();
      } catch (error) {
        setRepairMessage(error instanceof Error ? error.message : "Repair failed.");
      }
    });
  }

  function handleImageRepair() {
    if (!recipe.sourceUrl) return;
    setRepairMessage(null);
    startRepairTransition(async () => {
      try {
        const result = await repairRecipeImageAction(recipe.id);
        setRepairMessage(result.message);
        if (result.ok) router.refresh();
      } catch (error) {
        setRepairMessage(error instanceof Error ? error.message : "Image repair failed.");
      }
    });
  }

  return (
    <div className="recipe-print space-y-8">
      {/* Hero */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="h-64 w-full sm:h-80">
          <RecipeImage
            src={recipe.imagePath}
            title={recipe.title}
            mealType={recipe.mealType}
            loading="eager"
          />
        </div>
        <div className="space-y-3 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand" className="capitalize">
              {recipe.mealType}
            </Badge>
            {recipe.difficulty && (
              <Badge className="capitalize">{recipe.difficulty}</Badge>
            )}
            <span className="inline-flex items-center gap-1 text-sm text-muted">
              <Clock className="h-4 w-4" /> {formatMinutes(recipe.totalMinutes)}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{recipe.title}</h1>
          {recipe.isPublic && dropperName && (
            <div className="flex items-center gap-2 text-sm text-muted">
              {dropperAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dropperAvatar}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <CircleUserRound className="h-4 w-4" />
                </span>
              )}
              <span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Dropper
                </span>{" "}
                {dropperName}
                {(dropperCount ?? 0) > 1 && (
                  <>
                    {" "}
                    and {dropperCount! - 1} other cook{dropperCount! - 1 === 1 ? "" : "s"}
                  </>
                )}
              </span>
            </div>
          )}
          {recipe.description && <p className="text-muted">{recipe.description}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {tags.map((t) =>
              readOnly ? (
                <Badge key={t} variant="neutral" className="capitalize">
                  #{t}
                </Badge>
              ) : (
                <Link key={t} href={`/recipes?tag=${encodeURIComponent(t)}`}>
                  <Badge variant="neutral" className="capitalize hover:bg-brand-soft">
                    #{t}
                  </Badge>
                </Link>
              ),
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 print:hidden">
        {actionsSlot}
        <Link href={`/recipes/${recipe.id}/cook`}>
          <Button size="lg" variant={readOnly ? "secondary" : "primary"}>
            <ChefHat className="h-5 w-5" /> {readOnly ? "Make this recipe" : "Start cooking"}
          </Button>
        </Link>
        {!readOnly && (
          <>
            <Link href={`/recipes/${recipe.id}/edit`}>
              <Button variant="secondary" size="lg">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            </Link>
            <RecipePublicToggle
              recipeId={recipe.id}
              initialPublic={recipe.isPublic}
              onChange={setIsPublic}
            />
          </>
        )}
        {readOnly || isPublic ? (
          <ShareLinkButton
            href={`/r/${recipe.id}`}
            label={readOnly ? "Copy recipe link" : "Copy public link"}
          />
        ) : (
          <div className="flex items-center rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted">
            Make public to share
          </div>
        )}
        {!readOnly && recipe.sourceUrl && (
          <>
            <Button variant="secondary" size="lg" onClick={handleRepair} disabled={repairPending}>
              <Wrench className="h-4 w-4" /> {repairPending ? "Improving..." : "Improve"}
            </Button>
            <Button variant="secondary" size="lg" onClick={handleImageRepair} disabled={repairPending}>
              <ImageIcon className="h-4 w-4" /> Fix image
            </Button>
          </>
        )}
        {recipe.sourceUrl && (
          <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
            <Button variant="secondary" size="lg">
              <ExternalLink className="h-4 w-4" /> Source
            </Button>
          </a>
        )}
        <PrintButton />
        {!readOnly && (
          <Button variant="danger" size="lg" onClick={handleDelete} disabled={isPending}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
      </div>
      {couldUseHelp && recipe.sourceUrl && !readOnly && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
          This one looks like it may be missing a photo or details. Use <strong>Improve</strong>{" "}
          or <strong>Fix image</strong> to have RecipeDrop try the source again.
        </div>
      )}
      {repairMessage && (
        <div className="rounded-xl border border-border bg-surface p-3 text-sm text-muted print:hidden">
          {repairMessage}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        {/* Ingredients */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Ingredients</h2>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-2">
            <span className="flex items-center gap-2 pl-2 text-sm font-medium">
              <Users className="h-4 w-4 text-muted" /> Servings
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card hover:bg-brand-soft"
                aria-label="Fewer servings"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center font-semibold">{servings}</span>
              <button
                onClick={() => setServings((s) => s + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card hover:bg-brand-soft"
                aria-label="More servings"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {ingredients.map((ing) => {
              const checked = checkedIngredients.has(ing.id);
              return (
                <li key={ing.id}>
                  <button
                    type="button"
                    aria-pressed={checked}
                    onClick={() =>
                      setCheckedIngredients((prev) => {
                        const next = new Set(prev);
                        if (next.has(ing.id)) next.delete(ing.id);
                        else next.add(ing.id);
                        return next;
                      })
                    }
                    className="flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-surface print:hover:bg-transparent"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition-colors print:hidden",
                        checked
                          ? "border-brand bg-brand text-brand-foreground"
                          : "border-border bg-card",
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span
                      className={cn(
                        "text-sm transition-opacity",
                        checked && "text-muted line-through opacity-60 print:no-underline print:opacity-100",
                      )}
                    >
                      <span className="font-medium">{scaledAmount(ing, factor)}</span>{" "}
                      {displayName(ing)}
                      {ing.note && <span className="text-muted"> · {ing.note}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Directions</h2>
          <ol className="space-y-3">
            {steps.map((s) => (
              <li
                key={s.id}
                className="flex gap-4 rounded-2xl border border-border bg-card p-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">
                  {s.stepNumber}
                </span>
                <div className="space-y-1 pt-0.5">
                  <p className="leading-relaxed">{s.instruction}</p>
                  {s.durationMinutes ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <Clock className="h-3 w-3" /> about {formatMinutes(s.durationMinutes)}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function displayName(ing: RecipeIngredient): string {
  return ing.canonicalName ?? ing.rawText;
}

/** Scaled, friendly amount for an ingredient line. */
function scaledAmount(ing: RecipeIngredient, factor: number): string {
  if (ing.quantity == null) {
    // no number — show the unit/qualifier as-is ("to taste", "a pinch")
    return ing.unit ?? "";
  }
  const qty = tidyNumber(ing.quantity * factor);
  if (!ing.unit) return `${qty}×`;
  const unit = ing.unitCategory === "count" ? pluralize(ing.unit, qty) : ing.unit;
  return `${qty} ${unit}`;
}
