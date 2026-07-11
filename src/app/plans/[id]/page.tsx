import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOwnerEmail } from "@/lib/auth";
import { getPlanFull, getLatestShoppingList } from "@/lib/repo/plans";
import { listPantryItems } from "@/lib/repo/pantry";
import { listRecipes } from "@/lib/repo/recipes";
import { PlanEditor } from "./plan-editor";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owner = await getOwnerEmail();
  const data = await getPlanFull(owner, id);
  if (!data) notFound();

  const [allRecipes, shopping, pantry] = await Promise.all([
    listRecipes(owner),
    getLatestShoppingList(owner, id),
    listPantryItems(owner),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/plans"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All lists
      </Link>
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
                items: shopping.items.map((s) => ({
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
                  inPantry:
                    pantry.find((item) => item.canonicalName === s.canonicalName)?.inPantry ??
                    false,
                  hasLeftover:
                    pantry.find((item) => item.canonicalName === s.canonicalName)?.hasLeftover ??
                    false,
                })),
              }
            : null
        }
      />
    </div>
  );
}
