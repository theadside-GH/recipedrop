import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getRecipeFull } from "@/lib/repo/recipes";
import { RecipeDetail } from "@/components/recipe-detail";

export const dynamic = "force-dynamic";

export default async function PublicRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getRecipeFull(id);
  if (!data || !data.recipe.isPublic) notFound();

  return (
    <div className="space-y-5">
      <Link
        href="/discover"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Discover recipes
      </Link>
      <RecipeDetail
        recipe={data.recipe}
        ingredients={data.ingredients}
        steps={data.steps}
        tags={data.tags}
        dropperName={data.dropper?.handle ? `@${data.dropper.handle}` : data.dropper?.displayName}
        dropperAvatar={data.dropper?.avatarUrl}
        readOnly
      />
    </div>
  );
}
