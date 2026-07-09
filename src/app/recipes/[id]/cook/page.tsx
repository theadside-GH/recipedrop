import { notFound } from "next/navigation";
import { getOwnerEmail } from "@/lib/auth";
import { getRecipeFull } from "@/lib/repo/recipes";
import { CookMode } from "./cook-mode";

export const dynamic = "force-dynamic";

export default async function CookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, viewer] = await Promise.all([getRecipeFull(id), getOwnerEmail()]);
  if (!data) notFound();
  const isOwner = data.recipe.ownerEmail === viewer;
  // Public drops are cookable by anyone; private recipes only by their owner.
  if (!isOwner && !data.recipe.isPublic) notFound();

  return (
    <CookMode
      recipeId={data.recipe.id}
      exitHref={isOwner ? `/recipes/${data.recipe.id}` : `/r/${data.recipe.id}`}
      title={data.recipe.title}
      steps={data.steps.map((s) => ({
        number: s.stepNumber,
        instruction: s.instruction,
        durationMinutes: s.durationMinutes,
      }))}
      ingredients={data.ingredients.map((i) => ({
        text: `${i.quantity ?? ""} ${i.unit ?? ""} ${i.canonicalName ?? i.rawText}`.trim(),
        note: i.note,
      }))}
    />
  );
}
