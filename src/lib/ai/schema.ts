import { z } from "zod/v4";

/**
 * The single canonical shape every ingestion source converges to. Claude is
 * constrained to emit exactly this via structured outputs, so website / text /
 * photo / YouTube all produce the same object and the rest of the app never
 * has to care where a recipe came from.
 */

export const MEAL_TYPES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "dessert",
  "side",
  "drink",
] as const;

type MealType = (typeof MEAL_TYPES)[number];

const MEAL_TYPE_ALIASES: Record<string, MealType> = {
  app: "snack",
  appetizer: "snack",
  appetizers: "snack",
  starter: "snack",
  starters: "snack",
  "hors d'oeuvre": "snack",
  "hors d'oeuvres": "snack",
  horsdoeuvre: "snack",
  horsdoeuvres: "snack",
  "small plate": "snack",
  "small plates": "snack",
  party: "snack",
  "party food": "snack",
  brunch: "breakfast",
  beverage: "drink",
  beverages: "drink",
  cocktail: "drink",
  cocktails: "drink",
  entree: "dinner",
  "main course": "dinner",
  "main dish": "dinner",
  main: "dinner",
  soup: "dinner",
  salad: "side",
  bread: "side",
  baking: "side",
  "baked goods": "side",
  sauce: "side",
  condiment: "side",
  dressing: "side",
  "side dish": "side",
  baked: "dessert",
  cake: "dessert",
  cookies: "dessert",
  sweet: "dessert",
};

/**
 * The SDK's structured-output transform does NOT constrain z.enum fields — it
 * sends them as plain strings with the options in the description. So the
 * model can and does return "bread" or "weight", and a strict enum failed the
 * whole import over one label. Every enum here normalizes aliases, then falls
 * back to a safe default instead of throwing.
 */
// (No .transform() here: the SDK can't turn transforms into JSON Schema.)
function normalizeLabel(aliases: Record<string, string>) {
  return (value: unknown) => {
    if (typeof value !== "string") return value;
    const normalized = value.toLowerCase().trim().replace(/[’‘]/g, "'");
    return aliases[normalized] ?? normalized;
  };
}

function lenientEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  aliases: Record<string, T[number]>,
  fallback: T[number],
) {
  return z.preprocess(normalizeLabel(aliases), z.enum(values).catch(fallback));
}

function lenientNullableEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  aliases: Record<string, T[number]>,
) {
  return z.preprocess(normalizeLabel(aliases), z.enum(values).nullable().catch(null));
}

const mealTypeSchema = lenientEnum(MEAL_TYPES, MEAL_TYPE_ALIASES, "dinner");

export const UNIT_CATEGORIES = [
  "mass",
  "volume",
  "count",
  "pinch",
  "unknown",
] as const;

const UNIT_CATEGORY_ALIASES: Record<string, (typeof UNIT_CATEGORIES)[number]> = {
  weight: "mass",
  liquid: "volume",
  piece: "count",
  pieces: "count",
  each: "count",
  whole: "count",
  unit: "count",
  dash: "pinch",
  "to taste": "pinch",
  handful: "pinch",
};

export const extractedIngredientSchema = z.object({
  raw: z.string().describe("The original ingredient line, verbatim."),
  canonicalName: z
    .string()
    .describe(
      "The core grocery item: singular, lowercase, no brand, no prep words. e.g. '2 boneless skinless chicken breasts' -> 'chicken breast'.",
    ),
  quantity: z
    .number()
    .nullable()
    .describe("Numeric amount for the default servings, or null if none."),
  unit: z
    .string()
    .nullable()
    .describe("Normalized unit token: g, kg, oz, ml, tsp, tbsp, cup, clove, can, or null for a plain count."),
  unitCategory: lenientEnum(UNIT_CATEGORIES, UNIT_CATEGORY_ALIASES, "unknown"),
  note: z
    .string()
    .nullable()
    .describe("Prep or qualifier, e.g. 'finely chopped', 'to taste', 'room temperature'."),
  optional: z.boolean().describe("Whether this ingredient is optional."),
});

export const extractedStepSchema = z.object({
  instruction: z.string().describe("One clear, idiot-proof step."),
  durationMinutes: z
    .number()
    .nullable()
    .describe("Minutes this step takes if it implies waiting/cooking, else null."),
});

export const recipeExtractionSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  mealType: mealTypeSchema,
  difficulty: lenientNullableEnum(["easy", "medium", "hard"] as const, { moderate: "medium", intermediate: "medium", simple: "easy", beginner: "easy", advanced: "hard", difficult: "hard" }),
  prepMinutes: z.number().nullable(),
  cookMinutes: z.number().nullable(),
  totalMinutes: z.number().nullable(),
  servings: z.number().describe("Default number of servings this recipe yields."),
  imageUrl: z
    .string()
    .nullable()
    .describe("A direct image URL for the dish if one is present in the source."),
  sourceAuthor: z.string().nullable(),
  tags: z
    .array(z.string())
    .describe("Helpful facets like 'vegetarian', 'one-pot', 'gluten-free', 'quick'."),
  ingredients: z.array(extractedIngredientSchema),
  steps: z.array(extractedStepSchema),
});

export type RecipeExtraction = z.infer<typeof recipeExtractionSchema>;
export type ExtractedIngredient = z.infer<typeof extractedIngredientSchema>;
