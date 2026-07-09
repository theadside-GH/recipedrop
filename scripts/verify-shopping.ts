/**
 * End-to-end verification of the meal-plan → shopping-list flow against the
 * real (PGlite) database and seeded recipes. Proves the "3 apples" merge and
 * the chicken-breast cross-unit separation work through the full stack.
 *
 * Run: node --conditions=react-server --import tsx scripts/verify-shopping.ts
 */
import { env } from "../src/lib/env";
import { listRecipes } from "../src/lib/repo/recipes";
import {
  createPlan,
  addRecipeToPlan,
  generateShoppingList,
  getLatestShoppingList,
} from "../src/lib/repo/plans";

async function main() {
  const owner = env.ownerEmail;
  const recipes = await listRecipes(owner);
  const byTitle = (t: string) => recipes.find((r) => r.title === t);

  const oatmeal = byTitle("Apple Cinnamon Oatmeal"); // 1 apple, serves 2
  const salad = byTitle("Apple Walnut Spinach Salad"); // 2 apples, serves 4
  const lemon = byTitle("Lemon Garlic Chicken"); // 2 chicken breasts (count), serves 2
  const bowl = byTitle("Chicken Rice Bowl"); // 500 g chicken breast, serves 4

  if (!oatmeal || !salad || !lemon || !bowl) {
    throw new Error("Seed recipes missing — run `npm run db:seed` first.");
  }

  const plan = await createPlan(owner, "Verification plan");
  // Oatmeal for 2 (default) -> 1 apple. Salad for 4 (default) -> 2 apples. => 3 apples.
  await addRecipeToPlan(owner, plan.id, oatmeal.id, 2);
  await addRecipeToPlan(owner, plan.id, salad.id, 4);
  // Chicken in two incompatible units across recipes.
  await addRecipeToPlan(owner, plan.id, lemon.id, 2);
  await addRecipeToPlan(owner, plan.id, bowl.id, 4);

  await generateShoppingList(owner, plan.id);
  const list = await getLatestShoppingList(owner, plan.id);
  if (!list) throw new Error("No shopping list generated.");

  console.log("\n=== Generated shopping list ===");
  for (const it of list.items) {
    console.log(
      `[${it.aisle ?? "Other"}] ${it.canonicalName}: ${it.displayText}` +
        (it.isSummable ? "" : "  (listed separately)"),
    );
  }

  const apple = list.items.find((i) => i.canonicalName === "apple");
  const chicken = list.items.find((i) => i.canonicalName === "chicken breast");

  console.log("\n=== Assertions ===");
  const appleOk = apple?.displayText === "3";
  console.log(`apple == "3": ${appleOk ? "PASS" : "FAIL (" + apple?.displayText + ")"}`);
  const chickenOk = chicken && !chicken.isSummable && chicken.displayText.includes("500 g") && chicken.displayText.includes("2");
  console.log(
    `chicken breast listed separately (500 g + 2): ${chickenOk ? "PASS" : "FAIL (" + chicken?.displayText + ")"}`,
  );

  process.exit(appleOk && chickenOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
