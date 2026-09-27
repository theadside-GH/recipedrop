import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOwnerEmail } from "@/lib/auth";
import { getRecipeFull } from "@/lib/repo/recipes";
import { CookMode } from "./cook-mode";

export const dynamic = "force-dynamic";

const loadRecipe = cache(getRecipeFull);

/** "Cooking: <dish>" in the tab — for anyone allowed to open this page. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [data, viewer] = await Promise.all([loadRecipe(id), getOwnerEmail()]);
  if (!data || (data.recipe.ownerEmail !== viewer && !data.recipe.isPublic)) return {};
  return { title: `Cooking: ${data.recipe.title}` };
}

export default async function CookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ servings?: string }>;
}) {
  const [{ id }, sp, viewer] = await Promise.all([params, searchParams, getOwnerEmail()]);
  const data = await loadRecipe(id);
  if (!data) notFound();
  const isOwner = data.recipe.ownerEmail === viewer;
  // Public dishes are cookable by anyone; private recipes only by their owner.
  if (!isOwner && !data.recipe.isPublic) notFound();

  // Honor the servings chosen on the detail page — cook-mode amounts must
  // match what the user just scaled to, not silently revert to the default.
  const requested = Number(sp.servings);
  const servings =
    Number.isFinite(requested) && requested > 0
      ? Math.round(requested)
      : data.recipe.servingsDefault;
  const factor =
    data.recipe.servingsDefault > 0 ? servings / data.recipe.servingsDefault : 1;

  return (
    <CookMode
      recipeId={data.recipe.id}
      exitHref={isOwner ? `/recipes/${data.recipe.id}` : `/r/${data.recipe.id}`}
      editHref={isOwner ? `/recipes/${data.recipe.id}/edit` : undefined}
      title={data.recipe.title}
      servingsNote={servings !== data.recipe.servingsDefault ? `Scaled for ${servings} servings` : null}
      steps={data.steps.map((s) => ({
        number: s.stepNumber,
        instruction: s.instruction,
        durationMinutes: s.durationMinutes,
      }))}
      // Raw scaled amounts: cook mode formats them in the viewer's unit
      // setting (stored in the browser), same as the recipe page.
      ingredients={data.ingredients.map((i) => ({
        quantity: i.quantity != null ? i.quantity * factor : null,
        unit: i.unit,
        unitCategory: i.unitCategory,
        name: i.canonicalName ?? i.rawText,
        note: i.note,
      }))}
    />
  );
}
