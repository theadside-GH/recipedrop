import "server-only";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { getDb, type DB } from "@/lib/db";
import {
  mealPlan,
  mealPlanItem,
  recipe,
  recipeIngredient,
  shoppingList,
  shoppingListItem,
} from "@/lib/db/schema";
import {
  aggregateIngredients,
  scaleQuantity,
  type PlannedIngredient,
} from "@/lib/shopping/aggregate";
import { guessAisle } from "@/lib/shopping/aisle";
import { ingredientMatchKey } from "@/lib/shopping/normalize";

/** Subquery of plan ids the owner may touch — used to scope item-level writes. */
function ownedPlanIds(db: DB, ownerEmail: string) {
  return db.select({ id: mealPlan.id }).from(mealPlan).where(eq(mealPlan.ownerEmail, ownerEmail));
}

async function planIsOwned(db: DB, mealPlanId: string, ownerEmail: string): Promise<boolean> {
  const [row] = await db
    .select({ id: mealPlan.id })
    .from(mealPlan)
    .where(and(eq(mealPlan.id, mealPlanId), eq(mealPlan.ownerEmail, ownerEmail)))
    .limit(1);
  return !!row;
}

export async function createPlan(ownerEmail: string, name: string) {
  const db = await getDb();
  const [row] = await db
    .insert(mealPlan)
    .values({ ownerEmail, name: name.trim() || "This week" })
    .returning();
  return row;
}

export async function listPlans(ownerEmail: string) {
  const db = await getDb();
  const plans = await db
    .select({
      id: mealPlan.id,
      name: mealPlan.name,
      status: mealPlan.status,
      createdAt: mealPlan.createdAt,
      itemCount: sql<number>`count(${mealPlanItem.id})::int`,
    })
    .from(mealPlan)
    .leftJoin(mealPlanItem, eq(mealPlanItem.mealPlanId, mealPlan.id))
    .where(eq(mealPlan.ownerEmail, ownerEmail))
    .groupBy(mealPlan.id)
    .orderBy(desc(mealPlan.createdAt));
  if (plans.length === 0) return [];

  // Typed-in shopping items so a from-scratch list doesn't read "0 recipes".
  const customCounts = await db
    .select({
      mealPlanId: shoppingList.mealPlanId,
      n: sql<number>`count(*)::int`,
    })
    .from(shoppingListItem)
    .innerJoin(shoppingList, eq(shoppingList.id, shoppingListItem.shoppingListId))
    .where(
      and(
        inArray(shoppingList.mealPlanId, plans.map((p) => p.id)),
        eq(shoppingListItem.isCustom, true),
      ),
    )
    .groupBy(shoppingList.mealPlanId);
  const customByPlan = new Map(customCounts.map((c) => [c.mealPlanId, c.n]));
  return plans.map((p) => ({ ...p, customItemCount: customByPlan.get(p.id) ?? 0 }));
}

export async function getPlanFull(ownerEmail: string, id: string) {
  const db = await getDb();
  const [plan] = await db
    .select()
    .from(mealPlan)
    .where(and(eq(mealPlan.id, id), eq(mealPlan.ownerEmail, ownerEmail)))
    .limit(1);
  if (!plan) return null;
  const items = await db
    .select({
      id: mealPlanItem.id,
      plannedServings: mealPlanItem.plannedServings,
      recipeId: recipe.id,
      title: recipe.title,
      imagePath: recipe.imagePath,
      mealType: recipe.mealType,
      totalMinutes: recipe.totalMinutes,
      servingsDefault: recipe.servingsDefault,
    })
    .from(mealPlanItem)
    .innerJoin(recipe, eq(recipe.id, mealPlanItem.recipeId))
    .where(eq(mealPlanItem.mealPlanId, id));
  return { plan, items };
}

export async function addRecipeToPlan(
  ownerEmail: string,
  mealPlanId: string,
  recipeId: string,
  plannedServings: number,
) {
  const db = await getDb();
  if (!(await planIsOwned(db, mealPlanId, ownerEmail))) throw new Error("Plan not found.");
  const [r] = await db
    .select({ s: recipe.servingsDefault })
    .from(recipe)
    .where(and(eq(recipe.id, recipeId), eq(recipe.ownerEmail, ownerEmail)))
    .limit(1);
  if (!r) throw new Error("Recipe not found.");
  await db.insert(mealPlanItem).values({
    mealPlanId,
    recipeId,
    plannedServings: plannedServings || r.s || 2,
  });
}

export async function setPlannedServings(ownerEmail: string, itemId: string, servings: number) {
  const db = await getDb();
  await db
    .update(mealPlanItem)
    .set({ plannedServings: Math.max(1, Math.round(servings)) })
    .where(
      and(eq(mealPlanItem.id, itemId), inArray(mealPlanItem.mealPlanId, ownedPlanIds(db, ownerEmail))),
    );
}

export async function removePlanItem(ownerEmail: string, itemId: string) {
  const db = await getDb();
  await db
    .delete(mealPlanItem)
    .where(
      and(eq(mealPlanItem.id, itemId), inArray(mealPlanItem.mealPlanId, ownedPlanIds(db, ownerEmail))),
    );
}

export async function deletePlan(id: string, ownerEmail: string) {
  const db = await getDb();
  await db.delete(mealPlan).where(and(eq(mealPlan.id, id), eq(mealPlan.ownerEmail, ownerEmail)));
}

/**
 * Build the consolidated shopping list for a plan: scale every recipe's
 * ingredients to its planned servings, then aggregate across recipes. Replaces
 * any previous list for the plan with a fresh snapshot.
 */
export async function generateShoppingList(ownerEmail: string, mealPlanId: string): Promise<string> {
  const db = await getDb();
  if (!(await planIsOwned(db, mealPlanId, ownerEmail))) throw new Error("Plan not found.");
  const items = await db
    .select({
      recipeId: mealPlanItem.recipeId,
      plannedServings: mealPlanItem.plannedServings,
      servingsDefault: recipe.servingsDefault,
      title: recipe.title,
    })
    .from(mealPlanItem)
    .innerJoin(recipe, eq(recipe.id, mealPlanItem.recipeId))
    .where(eq(mealPlanItem.mealPlanId, mealPlanId));

  const lines: PlannedIngredient[] = [];
  const optionalLines: { name: string; recipeTitle: string }[] = [];
  for (const it of items) {
    const ings = await db
      .select()
      .from(recipeIngredient)
      .where(eq(recipeIngredient.recipeId, it.recipeId));
    for (const ing of ings) {
      const name = ing.canonicalName ?? ing.rawText;
      // Optional ingredients must not masquerade as required buys — they get
      // their own clearly-labeled lines below instead of joining the totals.
      if (ing.optional) {
        optionalLines.push({ name, recipeTitle: it.title });
        continue;
      }
      lines.push({
        canonicalName: name,
        quantity: scaleQuantity(ing.quantity, it.servingsDefault, it.plannedServings),
        unit: ing.unit,
        unitCategory: ing.unitCategory,
        aisle: guessAisle(name),
        recipeTitle: it.title,
      });
    }
  }

  const aggregated = aggregateIngredients(lines);

  // Optional extras: only ingredients no recipe requires outright, one line
  // each, labeled so the shopper knows they're skippable.
  const requiredKeys = new Set(aggregated.map((a) => ingredientMatchKey(a.canonicalName)));
  const seenOptional = new Set<string>();
  const optionalExtras = optionalLines.filter((o) => {
    const k = ingredientMatchKey(o.name);
    if (requiredKeys.has(k) || seenOptional.has(k)) return false;
    seenOptional.add(k);
    return true;
  });

  // Items the user typed in themselves carry over to the fresh snapshot.
  const previous = await getLatestShoppingList(ownerEmail, mealPlanId);
  const customItems = previous?.items.filter((item) => item.isCustom) ?? [];

  // Transaction: replace-the-list is delete + inserts — a crash in between
  // must never leave the plan with no list at all.
  return db.transaction(async (tx) => {
    await tx.delete(shoppingList).where(eq(shoppingList.mealPlanId, mealPlanId));
    const [list] = await tx.insert(shoppingList).values({ mealPlanId }).returning();

    if (aggregated.length) {
      await tx.insert(shoppingListItem).values(
        aggregated.map((a, i) => ({
          shoppingListId: list.id,
          canonicalName: a.canonicalName,
          aisle: a.aisle,
          displayText: a.displayText,
          totalQuantity: a.totalQuantity,
          baseUnit: a.baseUnit,
          unitCategory: a.unitCategory,
          isSummable: a.isSummable,
          sortOrder: i,
        })),
      );
    }
    if (optionalExtras.length) {
      await tx.insert(shoppingListItem).values(
        optionalExtras.map((o, i) => ({
          shoppingListId: list.id,
          canonicalName: o.name,
          aisle: guessAisle(o.name),
          displayText: `optional — for ${o.recipeTitle}`,
          totalQuantity: null,
          baseUnit: null,
          unitCategory: "unknown" as const,
          isSummable: false,
          sortOrder: aggregated.length + i,
        })),
      );
    }
    if (customItems.length) {
      await tx.insert(shoppingListItem).values(
        customItems.map((item, i) => ({
          shoppingListId: list.id,
          canonicalName: item.canonicalName,
          aisle: item.aisle,
          displayText: item.displayText,
          totalQuantity: item.totalQuantity,
          baseUnit: item.baseUnit,
          unitCategory: item.unitCategory,
          isSummable: item.isSummable,
          isChecked: item.isChecked,
          isCustom: true,
          sortOrder: aggregated.length + optionalExtras.length + i,
        })),
      );
    }
    return list.id;
  });
}

/**
 * Add a hand-typed item to the plan's shopping list, creating the list first
 * if the plan doesn't have one yet — this is what makes a from-scratch list
 * (no recipes at all) possible.
 */
export async function addCustomShoppingItem(
  ownerEmail: string,
  mealPlanId: string,
  name: string,
): Promise<void> {
  const cleaned = name.trim().toLowerCase();
  if (!cleaned) throw new Error("Type an item first.");
  const db = await getDb();
  if (!(await planIsOwned(db, mealPlanId, ownerEmail))) throw new Error("Plan not found.");

  let existing = await getLatestShoppingList(ownerEmail, mealPlanId);
  if (!existing) {
    await db.insert(shoppingList).values({ mealPlanId });
    existing = await getLatestShoppingList(ownerEmail, mealPlanId);
    if (!existing) throw new Error("Could not start a shopping list.");
  }
  // Singular-normalized dedupe: "tomatoes" shouldn't add a second line when
  // "tomato" is already there. Throw so the UI can say so — a silent return
  // reads as the add having done nothing.
  const key = ingredientMatchKey(cleaned);
  const duplicate = existing.items.find((item) => ingredientMatchKey(item.canonicalName) === key);
  if (duplicate) throw new Error(`“${duplicate.canonicalName}” is already on this list.`);

  const maxOrder = existing.items.reduce((max, item) => Math.max(max, item.sortOrder), -1);
  await db.insert(shoppingListItem).values({
    shoppingListId: existing.list.id,
    canonicalName: cleaned,
    aisle: guessAisle(cleaned),
    displayText: "added by you",
    totalQuantity: null,
    baseUnit: null,
    unitCategory: "unknown",
    isSummable: false,
    isCustom: true,
    sortOrder: maxOrder + 1,
  });
}

/** Remove a hand-typed item. Generated items stay — regenerating rebuilds them anyway. */
export async function removeCustomShoppingItem(
  ownerEmail: string,
  itemId: string,
): Promise<void> {
  const db = await getDb();
  const ownedListIds = db
    .select({ id: shoppingList.id })
    .from(shoppingList)
    .innerJoin(mealPlan, eq(mealPlan.id, shoppingList.mealPlanId))
    .where(eq(mealPlan.ownerEmail, ownerEmail));
  await db
    .delete(shoppingListItem)
    .where(
      and(
        eq(shoppingListItem.id, itemId),
        eq(shoppingListItem.isCustom, true),
        inArray(shoppingListItem.shoppingListId, ownedListIds),
      ),
    );
}

export async function getLatestShoppingList(ownerEmail: string, mealPlanId: string) {
  const db = await getDb();
  if (!(await planIsOwned(db, mealPlanId, ownerEmail))) return null;
  const [list] = await db
    .select()
    .from(shoppingList)
    .where(eq(shoppingList.mealPlanId, mealPlanId))
    .orderBy(desc(shoppingList.generatedAt))
    .limit(1);
  if (!list) return null;
  const items = await db
    .select()
    .from(shoppingListItem)
    .where(eq(shoppingListItem.shoppingListId, list.id))
    .orderBy(shoppingListItem.sortOrder);
  return { list, items };
}

export async function toggleShoppingItem(ownerEmail: string, itemId: string, checked: boolean) {
  const db = await getDb();
  const ownedListIds = db
    .select({ id: shoppingList.id })
    .from(shoppingList)
    .innerJoin(mealPlan, eq(mealPlan.id, shoppingList.mealPlanId))
    .where(eq(mealPlan.ownerEmail, ownerEmail));
  await db
    .update(shoppingListItem)
    .set({ isChecked: checked })
    .where(
      and(eq(shoppingListItem.id, itemId), inArray(shoppingListItem.shoppingListId, ownedListIds)),
    );
}
