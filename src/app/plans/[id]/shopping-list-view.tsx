"use client";

import { useState } from "react";
import { Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPurchaseAmount } from "@/lib/shopping/purchase";
import { toggleShoppingItemAction } from "@/app/actions";

export interface ShoppingItem {
  id: string;
  canonicalName: string;
  aisle: string | null;
  displayText: string;
  totalQuantity: number | null;
  baseUnit: string | null;
  unitCategory: "mass" | "volume" | "count" | "pinch" | "unknown";
  isChecked: boolean;
  isSummable: boolean;
}

export function ShoppingListView({
  planId,
  items,
  onChanged,
}: {
  planId: string;
  items: ShoppingItem[];
  onChanged: () => void;
}) {
  // Optimistic local checked state for snappy feel.
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((i) => [i.id, i.isChecked])),
  );

  async function toggle(item: ShoppingItem) {
    const next = !checked[item.id];
    setChecked((c) => ({ ...c, [item.id]: next }));
    await toggleShoppingItemAction(planId, item.id, next);
    onChanged();
  }

  // Group by aisle, preserving the server's sort.
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const aisle = item.aisle ?? "Other";
    if (!groups.has(aisle)) groups.set(aisle, []);
    groups.get(aisle)!.push(item);
  }

  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Shopping list</h2>
        <span className="text-sm text-muted">
          {checkedCount}/{items.length} in cart
        </span>
      </div>

      <div className="space-y-5">
        {[...groups.entries()].map(([aisle, groupItems]) => (
          <div key={aisle}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {aisle}
            </h3>
            <ul className="space-y-1.5">
              {groupItems.map((item) => {
                const isChecked = checked[item.id];
                const purchaseText = formatPurchaseAmount(item);
                const showRecipeAmount = purchaseText !== item.displayText;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => toggle(item)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                        isChecked
                          ? "border-border bg-surface"
                          : "border-border bg-card hover:bg-surface",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          isChecked
                            ? "border-fresh bg-fresh text-white"
                            : "border-border",
                        )}
                      >
                        {isChecked && <Check className="h-4 w-4" />}
                      </span>
                      <span className="flex-1">
                        <span
                          className={cn(
                            "font-medium capitalize",
                            isChecked && "text-muted line-through",
                          )}
                        >
                          {item.canonicalName}
                        </span>
                        <span className="ml-2 text-sm text-muted">{purchaseText}</span>
                        {showRecipeAmount && (
                          <span className="mt-0.5 block text-xs text-muted">
                            recipe amount: {item.displayText}
                          </span>
                        )}
                      </span>
                      {!item.isSummable && (
                        <span
                          title="Different units across recipes — listed separately rather than guessing a total."
                          className="text-muted"
                        >
                          <Info className="h-4 w-4" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
