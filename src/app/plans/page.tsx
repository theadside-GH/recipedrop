import Link from "next/link";
import { ShoppingBasket, ChevronRight } from "lucide-react";
import { getOwnerEmail } from "@/lib/auth";
import { listPlans } from "@/lib/repo/plans";
import { CreatePlan } from "./create-plan";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const owner = await getOwnerEmail();
  const plans = await listPlans(owner);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meal plans</h1>
        <p className="mt-1 text-muted">
          Pick recipes, set servings for each, and get one consolidated shopping list.
        </p>
      </div>

      <CreatePlan />

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center text-muted">
          No meal plans yet. Create one above to start your week.
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <Link
              key={p.id}
              href={`/plans/${p.id}`}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-surface"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
                <ShoppingBasket className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-muted">
                  {p.itemCount} recipe{p.itemCount === 1 ? "" : "s"}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
