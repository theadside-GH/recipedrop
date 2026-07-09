import { PageHeaderSkeleton, RecipeGridSkeleton } from "@/components/recipe-grid-skeleton";

export default function LoadingRecipes() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <RecipeGridSkeleton count={8} />
    </div>
  );
}
