import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOwnerEmail } from "@/lib/auth";
import { getRecipeFull } from "@/lib/repo/recipes";
import { RecipeEditForm } from "./recipe-edit-form";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, viewer] = await Promise.all([getRecipeFull(id), getOwnerEmail()]);
  // Only the owner may see the edit form — it exposes full private content.
  if (!data || data.recipe.ownerEmail !== viewer) notFound();

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
