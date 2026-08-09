"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Archive, Check, CloudOff, Copy, EyeOff, PackageCheck, Printer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatPurchaseAmount } from "@/lib/shopping/purchase";
import {
  removeShoppingItemAction,
  setLeftoverItemAction,
  setPantryItemAction,
  toggleShoppingItemAction,
} from "@/app/actions";

// ---------------------------------------------------------------------------
// Offline-tolerant writes. The list is used in the store — the one place bad
// connectivity is guaranteed — so a failed save must never silently lose a
// check-off. Every toggle goes through a queue persisted to localStorage:
// applied optimistically, flushed immediately when online, retried when the
// connection returns, and restored (still checked) after a reload.
// ---------------------------------------------------------------------------

type PendingOp =
  | { kind: "item"; planId: string; itemId: string; checked: boolean }
  | {
      kind: "pantry" | "leftover";
      planId: string;
      canonicalName: string;
      aisle: string | null;
      checked: boolean;
    };

const QUEUE_KEY = "dishcovered-list-queue-v1";

function opKey(op: PendingOp): string {
  return op.kind === "item"
    ? `item:${op.itemId}`
    : `${op.kind}:${op.planId}:${op.canonicalName}`;
}

function loadQueue(): PendingOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PendingOp[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(ops: PendingOp[]) {
  try {
    if (ops.length === 0) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
  } catch {
    // Storage full/blocked — the in-memory queue still retries this session.
  }
}

async function runOp(op: PendingOp): Promise<void> {
  if (op.kind === "item") {
    await toggleShoppingItemAction(op.planId, op.itemId, op.checked);
    return;
  }
  const input = {
    planId: op.planId,
    canonicalName: op.canonicalName,
    aisle: op.aisle,
    checked: op.checked,
  };
  if (op.kind === "pantry") await setPantryItemAction(input);
  else await setLeftoverItemAction(input);
}

// Module scope, not component state: the queue belongs to the tab (and to
// localStorage), so navigating away mid-flush doesn't abandon it.
let memoryQueue: PendingOp[] | null = null;
let flushing = false;

function getQueue(): PendingOp[] {
  if (memoryQueue === null) memoryQueue = loadQueue();
  return memoryQueue;
}

function setQueue(ops: PendingOp[]) {
  memoryQueue = ops;
  saveQueue(ops);
}

function enqueueOp(op: PendingOp) {
  const key = opKey(op);
  setQueue([...getQueue().filter((existing) => opKey(existing) !== key), op]);
}

/**
 * Replay queued ops in order; stops at the first failure. `stalled` is true
 * when ops remain because saving is currently impossible (offline or a save
 * failed) — the UI shows the banner only then, not during a normal in-flight
 * save.
 */
async function flushQueue(): Promise<{ remaining: number; stalled: boolean }> {
  if (flushing) return { remaining: getQueue().length, stalled: false };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { remaining: getQueue().length, stalled: getQueue().length > 0 };
  }
  flushing = true;
  let stalled = false;
  try {
    while (getQueue().length > 0) {
      // Remove by identity, never by position: a re-toggle of the in-flight
      // item coalesces the queue underneath this await, and a positional
      // slice(1) would then delete an op that was never sent.
      const op = getQueue()[0];
      try {
        await runOp(op);
      } catch {
        // Still offline (or the server hiccuped) — keep the rest queued and
        // let the online listener / next tap retry.
        stalled = true;
        break;
      }
      setQueue(getQueue().filter((queued) => queued !== op));
    }
  } finally {
    flushing = false;
  }
  return { remaining: getQueue().length, stalled };
}

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
  const [pending, setPending] = useState({ count: 0, stalled: false });

  function applyOpToOverrides(op: PendingOp) {
    if (op.kind === "item") {
      setCheckedOverrides((current) => ({ ...current, [op.itemId]: op.checked }));
      return;
    }
    const setOverrides = op.kind === "pantry" ? setPantryOverrides : setLeftoverOverrides;
    for (const item of items) {
      if (item.canonicalName === op.canonicalName) {
        setOverrides((current) => ({ ...current, [item.id]: op.checked }));
      }
    }
  }

  async function flush() {
    const before = getQueue().length;
    const { remaining, stalled } = await flushQueue();
    setPending({ count: remaining, stalled });
    if (before > 0 && remaining === 0) onChanged();
  }

  function enqueue(op: PendingOp) {
    applyOpToOverrides(op);
    enqueueOp(op);
    void flush();
  }

  useEffect(() => {
    // Restore unsaved check-offs from a previous (offline) visit and retry.
    // Deferred a tick so the localStorage-driven state lands after hydration
    // has settled against the server-rendered markup.
    const restore = window.setTimeout(() => {
      const queued = getQueue();
      if (queued.length > 0) {
        for (const op of queued) applyOpToOverrides(op);
        void flush();
      }
    }, 0);
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      window.clearTimeout(restore);
      window.removeEventListener("online", onOnline);
    };
    // Mount-only: the queue is re-applied against the initial item list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  function toggle(item: ShoppingItem) {
    enqueue({ kind: "item", planId, itemId: item.id, checked: !checked[item.id] });
  }

  function togglePantry(item: ShoppingItem) {
    enqueue({
      kind: "pantry",
      planId,
      canonicalName: item.canonicalName,
      aisle: item.aisle,
      checked: !pantry[item.id],
    });
  }

  async function removeCustom(item: ShoppingItem) {
    try {
      await removeShoppingItemAction(planId, item.id);
      onChanged();
    } catch {
      // Removal is rare and destructive-ish — don't queue it, just leave the
      // row in place so the user can try again.
    }
  }

  function toggleLeftover(item: ShoppingItem) {
    enqueue({
      kind: "leftover",
      planId,
      canonicalName: item.canonicalName,
      aisle: item.aisle,
      checked: !leftovers[item.id],
    });
  }

  const visibleItems = hideChecked ? items.filter((item) => !checked[item.id]) : items;
  const groups = useMemo(() => groupByAisle(visibleItems), [visibleItems]);
  const checkedCount = Object.values(checked).filter(Boolean).length;
  // "To buy" excludes what you already have — flagging Pantry/Left over must
  // visibly shrink the shop, not just feed the suggestion engine.
  const remainingCount = items.filter(
    (item) => !checked[item.id] && !pantry[item.id] && !leftovers[item.id],
  ).length;
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
      {pending.count > 0 && pending.stalled && (
        <div
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 print:hidden"
        >
          <span className="flex items-center gap-2">
            <CloudOff className="h-4 w-4 shrink-0" />
            {pending.count} change{pending.count === 1 ? "" : "s"} saved on this phone and
            waiting to sync — nothing is lost.
          </span>
          <Button type="button" variant="secondary" size="sm" onClick={() => void flush()}>
            Retry now
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Shopping list</h2>
          <span className="text-sm text-muted">
            {checkedCount}/{items.length} in cart
            {remainingCount > 0 ? ` - ${remainingCount} to buy` : ""}
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
                  const haveIt = pantry[item.id] || leftovers[item.id];
                  const purchaseText = haveIt
                    ? "you have this — skip buying"
                    : formatPurchaseAmount(item);
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
                            ? "border-fresh bg-fresh text-background"
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
