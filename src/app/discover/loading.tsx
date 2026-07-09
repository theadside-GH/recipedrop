import { PageHeaderSkeleton, RecipeGridSkeleton } from "@/components/recipe-grid-skeleton";

export default function LoadingDiscover() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <RecipeGridSkeleton count={8} />
      <RecipeGridSkeleton count={4} />
    </div>
  );
}
