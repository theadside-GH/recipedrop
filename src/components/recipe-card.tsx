import Link from "next/link";
import { Clock, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RecipeImage } from "@/components/recipe-image";
import { formatMinutes } from "@/lib/utils";
import type { Recipe } from "@/lib/db/schema";

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const quick = (recipe.totalMinutes ?? 999) <= 30;
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface">
        <RecipeImage
          src={recipe.imagePath}
          title={recipe.title}
          mealType={recipe.mealType}
          imgClassName="transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge variant="solid" className="capitalize">
            {recipe.mealType}
          </Badge>
        </div>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug">{recipe.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatMinutes(recipe.totalMinutes)}
          </span>
          {recipe.difficulty && (
            <span className="inline-flex items-center gap-1 capitalize">
              <UtensilsCrossed className="h-3.5 w-3.5" />
              {recipe.difficulty}
            </span>
          )}
          {quick && <Badge variant="fresh">Quick</Badge>}
        </div>
      </div>
    </Link>
  );
}
