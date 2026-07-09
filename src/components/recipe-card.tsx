import Link from "next/link";
import type React from "react";
import { Clock, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RecipeImage } from "@/components/recipe-image";
import { FavoriteButton } from "@/components/favorite-button";
import { formatMinutes } from "@/lib/utils";
import type { Recipe } from "@/lib/db/schema";

export function RecipeCard({
  recipe,
  showFavorite = true,
  byline,
  bylineAvatar,
  href,
  topRightSlot,
}: {
  recipe: Recipe;
  showFavorite?: boolean;
  byline?: string;
  bylineAvatar?: string | null;
  href?: string;
  /** Overlay action rendered in the top-right corner (e.g. quick-save). */
  topRightSlot?: React.ReactNode;
}) {
  const quick = (recipe.totalMinutes ?? 999) <= 30;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
      <Link href={href ?? `/recipes/${recipe.id}`} className="block">
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
          <h3 className="line-clamp-2 font-display text-[1.06rem] font-semibold leading-snug">
            {recipe.title}
          </h3>
          {byline && (
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted">
              {bylineAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bylineAvatar} alt="" className="h-4 w-4 rounded-full object-cover" />
              ) : (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[9px] font-semibold text-brand">
                  {byline.replace(/^@/, "").slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="truncate">Dropped by {byline}</span>
            </p>
          )}
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
      {showFavorite && (
        <FavoriteButton
          recipeId={recipe.id}
          initialFavorite={recipe.isFavorite}
          className="absolute right-3 top-3 z-10"
        />
      )}
      {topRightSlot && <div className="absolute right-3 top-3 z-10">{topRightSlot}</div>}
    </div>
  );
}
