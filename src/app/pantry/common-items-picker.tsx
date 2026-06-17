"use client";

import { useMemo, useState, useTransition } from "react";
import { Archive, Check, Loader2, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { setPantryItemAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COMMON_ITEMS = [
  "salt",
  "black pepper",
  "olive oil",
  "vegetable oil",
  "butter",
  "eggs",
  "milk",
  "flour",
  "sugar",
  "brown sugar",
  "baking powder",
  "baking soda",
  "vanilla",
  "rice",
  "pasta",
  "noodles",
  "breadcrumbs",
  "oats",
  "canned tomatoes",
  "tomato paste",
  "chicken stock",
  "vegetable stock",
  "soy sauce",
  "vinegar",
  "honey",
  "maple syrup",
  "hot sauce",
  "mayonnaise",
  "mustard",
  "ketchup",
  "garlic powder",
  "onion powder",
  "paprika",
  "cumin",
  "oregano",
  "cinnamon",
  "chili flakes",
  "cornstarch",
  "peanut butter",
  "beans",
  "lentils",
];

export function CommonItemsPicker({ selectedItems }: { selectedItems: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set(selectedItems));
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedCount = useMemo(
    () => COMMON_ITEMS.filter((item) => selected.has(item)).length,
    [selected],
  );

  function toggleItem(name: string) {
    const next = !selected.has(name);
    setSelected((current) => {
      const copy = new Set(current);
      if (next) copy.add(name);
      else copy.delete(name);
      return copy;
    });
    setPendingName(name);
    startTransition(async () => {
      try {
        await setPantryItemAction({
          canonicalName: name,
          aisle: "Pantry",
          checked: next,
        });
        router.refresh();
      } finally {
        setPendingName(null);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Archive className="h-5 w-5 text-brand" />
            Common pantry items
          </h2>
          <p className="mt-1 text-sm text-muted">
            Quickly check off staples you usually keep around.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setOpen((value) => !value)}>
          <PlusCircle className="h-4 w-4" />
          Common items
        </Button>
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {COMMON_ITEMS.map((name) => {
            const active = selected.has(name);
            const pending = isPending && pendingName === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleItem(name)}
                disabled={pending}
                className={cn(
                  "flex min-h-10 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm capitalize transition-colors disabled:opacity-60",
                  active
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-border bg-surface text-foreground hover:border-brand",
                )}
              >
                <span>{name}</span>
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  active && <Check className="h-4 w-4 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {!open && selectedCount > 0 && (
        <p className="mt-3 text-xs text-muted">
          {selectedCount} common item{selectedCount === 1 ? "" : "s"} selected.
        </p>
      )}
    </section>
  );
}
