/**
 * Seed the local database with a few sample recipes so the UI, meal planner and
 * shopping-list aggregation are demonstrable without an API key.
 *
 * Run: npm run db:seed
 */
import { env } from "../src/lib/env";
import { createRecipeFromExtraction } from "../src/lib/repo/recipes";
import { recipeCount } from "../src/lib/repo/recipes";
import type { RecipeExtraction } from "../src/lib/ai/schema";

type Ing = RecipeExtraction["ingredients"][number];
const ing = (
  raw: string,
  canonicalName: string,
  quantity: number | null,
  unit: string | null,
  unitCategory: Ing["unitCategory"],
  note: string | null = null,
): Ing => ({ raw, canonicalName, quantity, unit, unitCategory, note, optional: false });

const SAMPLES: Array<{
  ex: RecipeExtraction;
  sourceType: "url" | "text" | "photo" | "youtube";
}> = [
  {
    sourceType: "text",
    ex: {
      title: "Apple Cinnamon Oatmeal",
      description: "Warm, cozy breakfast oats with fresh apple and a hint of cinnamon.",
      mealType: "breakfast",
      difficulty: "easy",
      prepMinutes: 3,
      cookMinutes: 7,
      totalMinutes: 10,
      servings: 2,
      imageUrl: "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=800",
      sourceAuthor: null,
      tags: ["quick", "vegetarian", "breakfast"],
      ingredients: [
        ing("1 cup rolled oats", "rolled oats", 1, "cup", "volume"),
        ing("2 cups milk", "milk", 2, "cup", "volume"),
        ing("1 apple, diced", "apple", 1, null, "count", "diced"),
        ing("1 tsp cinnamon", "cinnamon", 1, "tsp", "volume"),
        ing("1 tbsp honey", "honey", 1, "tbsp", "volume"),
        ing("a pinch of salt", "salt", null, "pinch", "pinch", "to taste"),
      ],
      steps: [
        { instruction: "Add the oats, milk and a pinch of salt to a small pot.", durationMinutes: null },
        { instruction: "Bring to a gentle simmer over medium heat, stirring often.", durationMinutes: 2 },
        { instruction: "Cook until creamy and thickened.", durationMinutes: 5 },
        { instruction: "Stir in the diced apple, cinnamon and honey, then serve.", durationMinutes: null },
      ],
    },
  },
  {
    sourceType: "text",
    ex: {
      title: "Apple Walnut Spinach Salad",
      description: "A crunchy, fresh salad with sweet apple and toasted walnuts.",
      mealType: "lunch",
      difficulty: "easy",
      prepMinutes: 15,
      cookMinutes: 0,
      totalMinutes: 15,
      servings: 4,
      imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800",
      sourceAuthor: null,
      tags: ["vegetarian", "quick", "salad", "gluten-free"],
      ingredients: [
        ing("2 apples, thinly sliced", "apple", 2, null, "count", "thinly sliced"),
        ing("1/2 cup walnuts", "walnut", 0.5, "cup", "volume"),
        ing("5 oz baby spinach", "spinach", 5, "oz", "mass"),
        ing("1/2 cup crumbled feta", "feta", 0.5, "cup", "volume", "crumbled"),
        ing("3 tbsp olive oil", "olive oil", 3, "tbsp", "volume"),
        ing("salt and pepper to taste", "salt", null, null, "pinch", "to taste"),
      ],
      steps: [
        { instruction: "Toast the walnuts in a dry pan until fragrant.", durationMinutes: 4 },
        { instruction: "Toss the spinach, sliced apple and feta in a large bowl.", durationMinutes: null },
        { instruction: "Drizzle with olive oil, season, top with walnuts and serve.", durationMinutes: null },
      ],
    },
  },
  {
    sourceType: "text",
    ex: {
      title: "Lemon Garlic Chicken",
      description: "Juicy pan-seared chicken breasts in a bright lemon-garlic sauce.",
      mealType: "dinner",
      difficulty: "medium",
      prepMinutes: 10,
      cookMinutes: 20,
      totalMinutes: 30,
      servings: 2,
      imageUrl: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800",
      sourceAuthor: null,
      tags: ["high-protein", "dinner", "one-pan"],
      ingredients: [
        ing("2 chicken breasts", "chicken breast", 2, null, "count"),
        ing("3 cloves garlic, minced", "garlic", 3, "clove", "count", "minced"),
        ing("1 lemon, juiced", "lemon", 1, null, "count", "juiced"),
        ing("2 tbsp olive oil", "olive oil", 2, "tbsp", "volume"),
        ing("1 tbsp butter", "butter", 1, "tbsp", "volume"),
        ing("salt and pepper", "salt", null, null, "pinch", "to taste"),
      ],
      steps: [
        { instruction: "Season the chicken breasts on both sides with salt and pepper.", durationMinutes: null },
        { instruction: "Sear in olive oil over medium-high heat until golden.", durationMinutes: 6 },
        { instruction: "Flip and cook through.", durationMinutes: 6 },
        { instruction: "Add butter, garlic and lemon juice; spoon the sauce over and serve.", durationMinutes: 2 },
      ],
    },
  },
  {
    sourceType: "text",
    ex: {
      title: "Chicken Rice Bowl",
      description: "A simple weeknight rice bowl with seared chicken and scallions.",
      mealType: "dinner",
      difficulty: "easy",
      prepMinutes: 10,
      cookMinutes: 15,
      totalMinutes: 25,
      servings: 4,
      imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800",
      sourceAuthor: null,
      tags: ["meal-prep", "dinner", "high-protein"],
      ingredients: [
        ing("500 g chicken breast, cubed", "chicken breast", 500, "g", "mass", "cubed"),
        ing("1 cup rice", "rice", 1, "cup", "volume"),
        ing("2 tbsp soy sauce", "soy sauce", 2, "tbsp", "volume"),
        ing("2 scallions, sliced", "scallion", 2, null, "count", "sliced"),
        ing("1 tbsp olive oil", "olive oil", 1, "tbsp", "volume"),
      ],
      steps: [
        { instruction: "Cook the rice according to package directions.", durationMinutes: 15 },
        { instruction: "Sear the cubed chicken in olive oil until browned and cooked.", durationMinutes: 8 },
        { instruction: "Add soy sauce and toss to coat.", durationMinutes: 1 },
        { instruction: "Serve the chicken over rice, topped with scallions.", durationMinutes: null },
      ],
    },
  },
];

async function main() {
  const owner = env.ownerEmail;
  const existing = await recipeCount(owner);
  if (existing > 0) {
    console.log(`Database already has ${existing} recipes — skipping seed.`);
    process.exit(0);
  }
  for (const s of SAMPLES) {
    const id = await createRecipeFromExtraction(owner, s.ex, { sourceType: s.sourceType });
    console.log(`Seeded: ${s.ex.title} (${id})`);
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
