import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getRecipeFull } from "@/lib/repo/recipes";
import { RecipeEditForm } from "./recipe-edit-form";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getRecipeFull(id);
  if (!data) notFound();

  return (
    <div className="space-y-5">
      <Link
        href={`/recipes/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to recipe
      </Link>
      <RecipeEditForm
        recipe={data.recipe}
        ingredients={data.ingredients.map((ingredient) => ingredient.rawText)}
        steps={data.steps.map((item) => item.instruction)}
        tags={data.tags}
      />
    </div>
  );
}
