import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RecipeEditForm } from "../[id]/edit/recipe-edit-form";

export const dynamic = "force-dynamic";

/** Write a recipe by hand — no link, no photo, no AI needed. */
export default function NewRecipePage() {
  return (
    <div className="space-y-5">
      <Link
        href="/recipes"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Your Recipes
      </Link>
      <RecipeEditForm recipe={null} ingredients={[]} steps={[]} tags={[]} />
    </div>
  );
}
