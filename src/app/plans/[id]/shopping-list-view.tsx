"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { Archive, Check, Copy, EyeOff, PackageCheck, Printer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatPurchaseAmount } from "@/lib/shopping/purchase";
import {
  removeShoppingItemAction,
  setLeftoverItemAction,
  setPantryItemAction,
  toggleShoppingItemAction,
} from "@/app/actions";

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
  /** Typed in by the user — removable, and not tied to any recipe. */
  isCustom: boolean;
  inPantry: boolean;
  hasLeftover: boolean;
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
  const [pantryOverrides, setPantryOverrides] = useState<Record<string, boolean>>({});
  const [leftoverOverrides, setLeftoverOverrides] = useState<Record<string, boolean>>({});
  const [hideChecked, setHideChecked] = useState(false);
  const [copied, setCopied] = useState(false);
  const checked = useMemo(
    () =>
      Object.fromEntries(
        items.map((item) => [item.id, checkedOverrides[item.id] ?? item.isChecked]),
      ),
    [checkedOverrides, items],
  );
  const pantry = useMemo(
    () =>
      Object.fromEntries(
        items.map((item) => [item.id, pantryOverrides[item.id] ?? item.inPantry]),
      ),
    [pantryOverrides, items],
  );
  const leftovers = useMemo(
    () =>
      Object.fromEntries(
        items.map((item) => [item.id, leftoverOverrides[item.id] ?? item.hasLeftover]),
      ),
    [leftoverOverrides, items],
  );

  async function toggle(item: ShoppingItem) {
    const next = !checked[item.id];
    setCheckedOverrides((current) => ({ ...current, [item.id]: next }));
    await toggleShoppingItemAction(planId, item.id, next);
    onChanged();
  }

  async function togglePantry(item: ShoppingItem) {
    const next = !pantry[item.id];
    setPantryOverrides((current) => ({ ...current, [item.id]: next }));
    await setPantryItemAction({
      planId,
      canonicalName: item.canonicalName,
      aisle: item.aisle,
      checked: next,
    });
    onChanged();
  }

  async function removeCustom(item: ShoppingItem) {
    await removeShoppingItemAction(planId, item.id);
    onChanged();
  }

  async function toggleLeftover(item: ShoppingItem) {
    const next = !leftovers[item.id];
    setLeftoverOverrides((current) => ({ ...current, [item.id]: next }));
    await setLeftoverItemAction({
      planId,
      canonicalName: item.canonicalName,
      aisle: item.aisle,
      checked: next,
    });
    onChanged();
  }

  const visibleItems = hideChecked ? items.filter((item) => !checked[item.id]) : items;
  const groups = useMemo(() => groupByAisle(visibleItems), [visibleItems]);
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const remainingCount = items.length - checkedCount;
  const pantryCount = Object.values(pantry).filter(Boolean).length;
  const leftoverCount = Object.values(leftovers).filter(Boolean).length;

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
            {pantryCount > 0 ? ` - ${pantryCount} pantry` : ""}
            {leftoverCount > 0 ? ` - ${leftoverCount} left over` : ""}
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
                    <li
                      key={item.id}
                      className={cn(
                        "flex gap-3 rounded-xl border p-3 text-left transition-colors",
                        isChecked ? "border-border bg-surface" : "border-border bg-card",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(item)}
                        aria-label={
                          isChecked
                            ? `Mark ${item.canonicalName} as not in cart`
                            : `Mark ${item.canonicalName} as in cart`
                        }
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          isChecked
                            ? "border-fresh bg-fresh text-white"
                            : "border-border hover:border-brand",
                        )}
                      >
                        {isChecked && <Check className="h-4 w-4" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span
                            className={cn(
                              "font-medium capitalize",
                              isChecked && "text-muted line-through",
                            )}
                          >
                            {item.canonicalName}
                          </span>
                          <span className="text-sm text-muted">{purchaseText}</span>
                        </div>
                        {showRecipeAmount && (
                          <span className="mt-0.5 block text-xs text-muted">
                            recipe total: {item.displayText}
                          </span>
                        )}
                        {reviewNote && (
                          <span className="mt-0.5 block text-xs text-muted">{reviewNote}</span>
                        )}
                        <span className="mt-2 flex flex-wrap gap-2 print:hidden">
                          <MiniToggle active={pantry[item.id]} onClick={() => togglePantry(item)} icon={Archive}>
                            Pantry
                          </MiniToggle>
                          <MiniToggle
                            active={leftovers[item.id]}
                            onClick={() => toggleLeftover(item)}
                            icon={PackageCheck}
                          >
                            Left over
                          </MiniToggle>
                        </span>
                      </div>
                      {item.isCustom && (
                        <button
                          type="button"
                          onClick={() => removeCustom(item)}
                          aria-label={`Remove ${item.canonicalName} from the list`}
                          title="Remove this item"
                          className="mt-0.5 shrink-0 self-start rounded-full p-1.5 text-muted transition-colors hover:bg-red-50 hover:text-red-600 print:hidden"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
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

function MiniToggle({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand bg-brand-soft text-brand"
          : "border-border bg-surface text-muted hover:border-brand hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
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
