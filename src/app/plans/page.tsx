import Link from "next/link";
import { ShoppingBasket, ChevronRight } from "lucide-react";
import { getOwnerEmail } from "@/lib/auth";
import { features } from "@/lib/env";
import { listPlans } from "@/lib/repo/plans";
import { listPantryItems } from "@/lib/repo/pantry";
import { recipeCount } from "@/lib/repo/recipes";
import { CreatePlan } from "./create-plan";
import { DeletePlanButton } from "./delete-plan-button";
import { PlanAutopilot } from "./plan-autopilot";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const owner = await getOwnerEmail();
  const [plans, recipes, pantryItems] = await Promise.all([
    listPlans(owner),
    recipeCount(owner),
    listPantryItems(owner),
  ]);
  const showAutopilot = features.aiEnabled && recipes >= 3;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Shopping lists</h1>
        <p className="mt-1 text-muted">
          Plan meals from your recipes — or start a list from scratch — and get one
          consolidated shopping list either way.
        </p>
      </div>

      {showAutopilot && (
        <PlanAutopilot
          hasPantryItems={pantryItems.some((item) => item.inPantry || item.hasLeftover)}
        />
      )}

      <CreatePlan />

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center text-muted">
          No lists yet. Create one above — add recipes to it, or just type in what you need.
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-surface"
            >
              <Link href={`/plans/${p.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <ShoppingBasket className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-sm text-muted">
                    {p.itemCount} recipe{p.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
              </Link>
              <DeletePlanButton planId={p.id} planName={p.name} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
