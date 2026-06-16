"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ImagePlus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { updateRecipeAction } from "@/app/actions";
import { imageFileToDataUrl } from "@/lib/client-image";
import type { Recipe } from "@/lib/db/schema";

const mealTypes = ["breakfast", "lunch", "dinner", "snack", "dessert", "side", "drink"];
const difficulties = ["easy", "medium", "hard"];

export function RecipeEditForm({
  recipe,
  ingredients,
  steps,
  tags,
}: {
  recipe: Recipe;
  ingredients: string[];
  steps: string[];
  tags: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: recipe.title,
    description: recipe.description ?? "",
    sourceUrl: recipe.sourceUrl ?? "",
    sourceAuthor: recipe.sourceAuthor ?? "",
    imagePath: recipe.imagePath ?? "",
    prepMinutes: String(recipe.prepMinutes ?? ""),
    cookMinutes: String(recipe.cookMinutes ?? ""),
    totalMinutes: String(recipe.totalMinutes ?? ""),
    servingsDefault: String(recipe.servingsDefault),
    mealType: recipe.mealType,
    difficulty: recipe.difficulty ?? "",
    tags: tags.join(", "),
    ingredients: ingredients.join("\n"),
    steps: steps.join("\n"),
  });

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function chooseImage(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await imageFileToDataUrl(file, { maxSize: 900, quality: 0.76 });
      setField("imagePath", dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updateRecipeAction(recipe.id, {
          title: form.title,
          description: form.description || null,
          sourceUrl: form.sourceUrl || null,
          sourceAuthor: form.sourceAuthor || null,
          imagePath: form.imagePath || null,
          prepMinutes: numberOrNull(form.prepMinutes),
          cookMinutes: numberOrNull(form.cookMinutes),
          totalMinutes: numberOrNull(form.totalMinutes),
          servingsDefault: Math.max(1, numberOrNull(form.servingsDefault) ?? 1),
          mealType: form.mealType,
          difficulty: form.difficulty || null,
          tags: splitCommaList(form.tags),
          ingredients: splitLines(form.ingredients),
          steps: splitLines(form.steps),
        });
        router.push(`/recipes/${recipe.id}`);
        router.refresh();
      } catch (err) {
        console.error(err);
        setError("That did not save. Check the fields and try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Edit recipe</h1>
        <p className="text-sm text-muted">
          Fix anything the import missed, then save it back to your library.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium">Title</span>
          <Input
            value={form.title}
            onChange={(event) => setField("title", event.target.value)}
            required
          />
        </label>

        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium">Description</span>
          <Textarea
            value={form.description}
            onChange={(event) => setField("description", event.target.value)}
            rows={3}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Meal type</span>
          <select
            value={form.mealType}
            onChange={(event) => setField("mealType", event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm text-foreground focus:border-brand focus-visible:outline-none"
          >
            {mealTypes.map((type) => (
              <option key={type} value={type}>
                {capitalize(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Difficulty</span>
          <select
            value={form.difficulty}
            onChange={(event) => setField("difficulty", event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm text-foreground focus:border-brand focus-visible:outline-none"
          >
            <option value="">Not set</option>
            {difficulties.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {capitalize(difficulty)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Servings</span>
          <Input
            type="number"
            min={1}
            value={form.servingsDefault}
            onChange={(event) => setField("servingsDefault", event.target.value)}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Tags</span>
          <Input
            value={form.tags}
            onChange={(event) => setField("tags", event.target.value)}
            placeholder="quick, vegetarian, one-pot"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Prep minutes</span>
          <Input
            type="number"
            min={0}
            value={form.prepMinutes}
            onChange={(event) => setField("prepMinutes", event.target.value)}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Cook minutes</span>
          <Input
            type="number"
            min={0}
            value={form.cookMinutes}
            onChange={(event) => setField("cookMinutes", event.target.value)}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Total minutes</span>
          <Input
            type="number"
            min={0}
            value={form.totalMinutes}
            onChange={(event) => setField("totalMinutes", event.target.value)}
          />
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium">Recipe photo</span>
          <div className="flex items-center gap-3">
            {form.imagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.imagePath}
                alt=""
                className="h-16 w-16 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface text-muted">
                <ImagePlus className="h-6 w-6" />
              </div>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-brand-soft">
              <ImagePlus className="h-4 w-4" />
              Choose photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => chooseImage(event.target.files?.[0])}
              />
            </label>
          </div>
          <Input
            value={form.imagePath.startsWith("data:") ? "" : form.imagePath}
            onChange={(event) => setField("imagePath", event.target.value)}
            placeholder="Or paste an image URL"
          />
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium">Source URL</span>
          <Input
            value={form.sourceUrl}
            onChange={(event) => setField("sourceUrl", event.target.value)}
            placeholder="https://..."
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Source author</span>
          <Input
            value={form.sourceAuthor}
            onChange={(event) => setField("sourceAuthor", event.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium">Ingredients</span>
          <Textarea
            value={form.ingredients}
            onChange={(event) => setField("ingredients", event.target.value)}
            rows={12}
            className="min-h-72"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Directions</span>
          <Textarea
            value={form.steps}
            onChange={(event) => setField("steps", event.target.value)}
            rows={12}
            className="min-h-72"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={isPending}>
          <Save className="h-5 w-5" /> {isPending ? "Saving..." : "Save recipe"}
        </Button>
        <Link href={`/recipes/${recipe.id}`}>
          <Button type="button" variant="secondary" size="lg">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}

function numberOrNull(value: string): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
