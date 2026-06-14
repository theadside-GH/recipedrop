"use client";

import { useMemo, useState } from "react";
import { Check, Copy, EyeOff, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  const [checkedOverrides, setCheckedOverrides] = useState<Record<string, boolean>>({});
  const [hideChecked, setHideChecked] = useState(false);
  const [copied, setCopied] = useState(false);
  const checked = useMemo(
    () =>
      Object.fromEntries(
        items.map((item) => [item.id, checkedOverrides[item.id] ?? item.isChecked]),
      ),
    [checkedOverrides, items],
  );

  async function toggle(item: ShoppingItem) {
    const next = !checked[item.id];
    setCheckedOverrides((current) => ({ ...current, [item.id]: next }));
    await toggleShoppingItemAction(planId, item.id, next);
    onChanged();
  }

  const visibleItems = hideChecked ? items.filter((item) => !checked[item.id]) : items;
  const groups = useMemo(() => groupByAisle(visibleItems), [visibleItems]);
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const remainingCount = items.length - checkedCount;

  async function copyList() {
    const text = shoppingListText(visibleItems, checked);
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 print:border-0 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Shopping list</h2>
          <span className="text-sm text-muted">
            {checkedCount}/{items.length} in cart
            {remainingCount > 0 ? ` - ${remainingCount} left` : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setHideChecked((value) => !value)}
          >
            <EyeOff className="h-4 w-4" />
            {hideChecked ? "Show checked" : "Hide checked"}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={copyList}>
            <Copy className="h-4 w-4" />
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        {groups.size === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            All checked items are hidden.
          </div>
        ) : (
          [...groups.entries()].map(([aisle, groupItems]) => (
            <div key={aisle}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {aisle}
              </h3>
              <ul className="space-y-1.5">
                {groupItems.map((item) => {
                  const isChecked = checked[item.id];
                  const purchaseText = formatPurchaseAmount(item);
                  const showRecipeAmount = purchaseText !== item.displayText;
                  const reviewNote = reviewText(item);
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
                              recipe total: {item.displayText}
                            </span>
                          )}
                          {reviewNote && (
                            <span className="mt-0.5 block text-xs text-muted">
                              {reviewNote}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function groupByAisle(items: ShoppingItem[]) {
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const aisle = item.aisle ?? "Other";
    if (!groups.has(aisle)) groups.set(aisle, []);
    groups.get(aisle)!.push(item);
  }
  return groups;
}

function shoppingListText(items: ShoppingItem[], checked: Record<string, boolean>) {
  const groups = groupByAisle(items);
  const lines = ["Shopping list"];
  for (const [aisle, groupItems] of groups.entries()) {
    lines.push("", aisle);
    for (const item of groupItems) {
      const mark = checked[item.id] ? "x" : " ";
      lines.push(`[${mark}] ${item.canonicalName} - ${formatPurchaseAmount(item)}`);
    }
  }
  return lines.join("\n").trim();
}

function reviewText(item: ShoppingItem): string | null {
  if (item.isSummable) return null;
  if (item.displayText.includes("amount not specified")) {
    return "One recipe did not give an exact amount.";
  }
  if (item.displayText.includes(" + ")) {
    return "Amounts are listed separately because the units do not safely combine.";
  }
  return null;
}
