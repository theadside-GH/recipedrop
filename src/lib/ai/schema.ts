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

export const UNIT_CATEGORIES = [
  "mass",
  "volume",
  "count",
  "pinch",
  "unknown",
] as const;

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
  unitCategory: z.enum(UNIT_CATEGORIES),
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
  mealType: z.enum(MEAL_TYPES),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable(),
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
