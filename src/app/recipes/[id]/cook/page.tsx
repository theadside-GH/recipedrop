import { notFound } from "next/navigation";
import { getOwnerEmail } from "@/lib/auth";
import { getRecipeFull } from "@/lib/repo/recipes";
import { formatQuantity } from "@/lib/utils";
import { CookMode } from "./cook-mode";

export const dynamic = "force-dynamic";

export default async function CookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ servings?: string }>;
}) {
  const [{ id }, sp, viewer] = await Promise.all([params, searchParams, getOwnerEmail()]);
  const data = await getRecipeFull(id);
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
      ingredients={data.ingredients.map((i) => ({
        text: `${i.quantity != null ? formatQuantity(i.quantity * factor) : ""} ${i.unit ?? ""} ${i.canonicalName ?? i.rawText}`
          .replace(/\s+/g, " ")
          .trim(),
        note: i.note,
      }))}
    />
  );
}
