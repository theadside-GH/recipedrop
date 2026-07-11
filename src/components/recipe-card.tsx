import Link from "next/link";
import type React from "react";
import { Bookmark, ChefHat, Clock, UtensilsCrossed } from "lucide-react";
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
  bylineHref,
  href,
  topRightSlot,
  bottomRightSlot,
  cookedCount,
  dropperCount,
}: {
  recipe: Recipe;
  showFavorite?: boolean;
  byline?: string;
  bylineAvatar?: string | null;
  /** Link target for the byline (the cook's public page). */
  bylineHref?: string;
  href?: string;
  /** Overlay action rendered in the top-right corner (e.g. "Your dishcovery"). */
  topRightSlot?: React.ReactNode;
  /** Overlay action on the photo's bottom-right corner (e.g. save toggle). */
  bottomRightSlot?: React.ReactNode;
  /** "I made this" count shown on public cards when > 0. */
  cookedCount?: number;
  /** Cooks who have this dish (imported or saved); shown on public cards when > 1. */
  dropperCount?: number;
}) {
  const quick = (recipe.totalMinutes ?? 999) <= 30;
  const bylineContent = byline && (
    <>
      {bylineAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bylineAvatar} alt="" className="h-4 w-4 rounded-full object-cover" />
      ) : (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[9px] font-semibold text-brand">
          {byline.replace(/^@/, "").slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="truncate">Dishcovered by {byline}</span>
    </>
  );
  return (
    // The card link is a stretched overlay (rendered last, z-[5]) rather than
    // a wrapper, so the byline can be its own link — <a> can't nest in <a>.
    // Interactive corners (favorite, save, byline) sit above it at z-10.
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
      <div>
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
          {bottomRightSlot && (
            <div className="absolute bottom-3 right-3 z-10">{bottomRightSlot}</div>
          )}
        </div>
        <div className="p-4">
          <h3 className="line-clamp-2 font-display text-[1.06rem] font-semibold leading-snug">
            {recipe.title}
          </h3>
          {byline &&
            (bylineHref ? (
              <Link
                href={bylineHref}
                className="relative z-10 mt-1 flex items-center gap-1.5 truncate text-xs text-muted hover:text-brand hover:underline"
              >
                {bylineContent}
              </Link>
            ) : (
              <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted">
                {bylineContent}
              </p>
            ))}
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
            {(cookedCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1" title="People who made this">
                <ChefHat className="h-3.5 w-3.5" />
                {cookedCount}&times; made
              </span>
            )}
            {(dropperCount ?? 0) > 1 && (
              <span className="inline-flex items-center gap-1" title="Cooks who have this dish, imported or saved">
                <Bookmark className="h-3.5 w-3.5" />
                {dropperCount} cooks have this
              </span>
            )}
            {quick && <Badge variant="fresh">Quick</Badge>}
          </div>
        </div>
      </div>
      <Link
        href={href ?? `/recipes/${recipe.id}`}
        aria-label={recipe.title}
        className="absolute inset-0 z-[5]"
      />
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
