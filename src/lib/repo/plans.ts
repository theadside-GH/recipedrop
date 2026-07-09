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
    .values({ ownerEmail, name: name.trim() || "My meal plan" })
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
  return plans;
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
  for (const it of items) {
    const ings = await db
      .select()
      .from(recipeIngredient)
      .where(eq(recipeIngredient.recipeId, it.recipeId));
    for (const ing of ings) {
      const name = ing.canonicalName ?? ing.rawText;
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

  // Replace any prior list for this plan.
  await db.delete(shoppingList).where(eq(shoppingList.mealPlanId, mealPlanId));
  const [list] = await db.insert(shoppingList).values({ mealPlanId }).returning();

  if (aggregated.length) {
    await db.insert(shoppingListItem).values(
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
  return list.id;
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
