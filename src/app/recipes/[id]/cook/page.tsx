import { notFound } from "next/navigation";
import { getRecipeFull } from "@/lib/repo/recipes";
import { CookMode } from "./cook-mode";

export const dynamic = "force-dynamic";

export default async function CookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getRecipeFull(id);
  if (!data) notFound();

  return (
    <CookMode
      recipeId={data.recipe.id}
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
