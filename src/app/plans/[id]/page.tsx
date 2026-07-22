import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOwnerEmail } from "@/lib/auth";
import { getPlanFull, getLatestShoppingList } from "@/lib/repo/plans";
import { listPantryItems } from "@/lib/repo/pantry";
import { listRecipes } from "@/lib/repo/recipes";
import { ingredientMatchKey } from "@/lib/shopping/normalize";
import { PlanEditor } from "./plan-editor";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ planned?: string; asked?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const owner = await getOwnerEmail();
  const data = await getPlanFull(owner, id);
  if (!data) notFound();

  const [allRecipes, shopping, pantry] = await Promise.all([
    listRecipes(owner),
    getLatestShoppingList(owner, id),
    listPantryItems(owner),
  ]);

  const planned = Number(sp.planned);
  const asked = Number(sp.asked);
  const shortfall =
    Number.isFinite(planned) && Number.isFinite(asked) && planned > 0 && planned < asked;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/plans"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All lists
      </Link>
      {shortfall && (
        <p className="rounded-xl border border-brand/25 bg-brand-soft p-3 text-sm">
          Autopilot planned <strong>{planned}</strong> of the <strong>{asked}</strong> dinners you
          asked for — your library doesn&apos;t have enough different recipes yet. Add recipes to
          this plan by hand, or import more and run it again.
        </p>
      )}
      <PlanEditor
        planId={id}
        planName={data.plan.name}
        items={data.items.map((it) => ({
          id: it.id,
          recipeId: it.recipeId,
          title: it.title,
          imagePath: it.imagePath,
          mealType: it.mealType,
          totalMinutes: it.totalMinutes,
          servingsDefault: it.servingsDefault,
          plannedServings: it.plannedServings,
          dayOfWeek: it.dayOfWeek,
        }))}
        allRecipes={allRecipes.map((r) => ({
          id: r.id,
          title: r.title,
          imagePath: r.imagePath,
          mealType: r.mealType,
          servingsDefault: r.servingsDefault,
        }))}
        shopping={
          shopping
            ? {
                items: shopping.items.map((s) => {
                  // Singular-normalized match so pantry "eggs" flags an "egg"
                  // shopping line — raw names differ in number all the time.
                  const key = ingredientMatchKey(s.canonicalName);
                  const pantryRow = pantry.find(
                    (item) => ingredientMatchKey(item.canonicalName) === key,
                  );
                  return {
                    id: s.id,
                    canonicalName: s.canonicalName,
                    aisle: s.aisle,
                    displayText: s.displayText,
                    totalQuantity: s.totalQuantity,
                    baseUnit: s.baseUnit,
                    unitCategory: s.unitCategory,
                    isChecked: s.isChecked,
                    isSummable: s.isSummable,
                    isCustom: s.isCustom,
                    inPantry: pantryRow?.inPantry ?? false,
                    hasLeftover: pantryRow?.hasLeftover ?? false,
                  };
                }),
              }
            : null
        }
      />
    </div>
  );
}
