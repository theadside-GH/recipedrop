import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const mealTypeEnum = pgEnum("meal_type", [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "dessert",
  "side",
  "drink",
]);

export const unitCategoryEnum = pgEnum("unit_category", [
  "mass",
  "volume",
  "count",
  "pinch",
  "unknown",
]);

export const sourceTypeEnum = pgEnum("source_type", [
  "url",
  "text",
  "photo",
  "youtube",
]);

export const importStatusEnum = pgEnum("import_status", [
  "pending",
  "processing",
  "done",
  "needs_review",
  "failed",
]);

export const planStatusEnum = pgEnum("plan_status", [
  "draft",
  "active",
  "archived",
]);

// ---------------------------------------------------------------------------
// Canonical ingredients — the key that makes shopping-list merging reliable
// ---------------------------------------------------------------------------

export const canonicalIngredient = pgTable(
  "canonical_ingredient",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(), // singular, lowercase, no brand/prep e.g. "chicken breast"
    defaultUnitCategory: unitCategoryEnum("default_unit_category")
      .notNull()
      .default("unknown"),
    aisle: text("aisle"), // optional store section for grouping the shopping list
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("canonical_ingredient_name_idx").on(t.name)],
);

// ---------------------------------------------------------------------------
// User profiles
// ---------------------------------------------------------------------------

export const userProfile = pgTable(
  "user_profile",
  {
    email: text("email").primaryKey(),
    displayName: text("display_name").notNull(),
    handle: text("handle"),
    handleChangedAt: timestamp("handle_changed_at", { withTimezone: true }),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    publicFeedOptIn: boolean("public_feed_opt_in").notNull().default(false),
    paidTier: text("paid_tier").notNull().default("free"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("user_profile_handle_idx").on(t.handle)],
);

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export const recipe = pgTable(
  "recipe",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerEmail: text("owner_email").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    sourceType: sourceTypeEnum("source_type").notNull().default("text"),
    sourceUrl: text("source_url"),
    sourceAuthor: text("source_author"),
    imagePath: text("image_path"), // storage key or remote URL
    prepMinutes: integer("prep_minutes"),
    cookMinutes: integer("cook_minutes"),
    totalMinutes: integer("total_minutes"), // stored for fast "how quick" filtering
    servingsDefault: integer("servings_default").notNull().default(2),
    mealType: mealTypeEnum("meal_type").notNull().default("dinner"),
    difficulty: text("difficulty"), // "easy" | "medium" | "hard"
    isFavorite: boolean("is_favorite").notNull().default(false),
    isPublic: boolean("is_public").notNull().default(false),
    dropCount: integer("drop_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("recipe_owner_idx").on(t.ownerEmail),
    index("recipe_meal_type_idx").on(t.mealType),
    index("recipe_total_minutes_idx").on(t.totalMinutes),
    index("recipe_favorite_idx").on(t.isFavorite),
    index("recipe_public_idx").on(t.isPublic),
    index("recipe_drop_count_idx").on(t.dropCount),
  ],
);

export const recipeIngredient = pgTable(
  "recipe_ingredient",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    rawText: text("raw_text").notNull(), // original line, always kept for display
    canonicalIngredientId: uuid("canonical_ingredient_id").references(
      () => canonicalIngredient.id,
    ),
    canonicalName: text("canonical_name"), // denormalized for convenience/aggregation
    quantity: doublePrecision("quantity"), // per servingsDefault; nullable
    unit: text("unit"), // normalized token: g, ml, cup, count, ...
    unitCategory: unitCategoryEnum("unit_category").notNull().default("unknown"),
    note: text("note"), // prep/qualifier e.g. "finely chopped", "to taste"
    optional: boolean("optional").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("recipe_ingredient_recipe_idx").on(t.recipeId)],
);

export const step = pgTable(
  "step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull(),
    instruction: text("instruction").notNull(),
    durationMinutes: integer("duration_minutes"), // enables per-step timers
  },
  (t) => [index("step_recipe_idx").on(t.recipeId)],
);

export const tag = pgTable(
  "tag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("tag_name_idx").on(t.name)],
);

export const recipeTag = pgTable(
  "recipe_tag",
  {
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("recipe_tag_pk").on(t.recipeId, t.tagId)],
);

// ---------------------------------------------------------------------------
// Meal plans & shopping lists
// ---------------------------------------------------------------------------

export const mealPlan = pgTable("meal_plan", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerEmail: text("owner_email").notNull(),
  name: text("name").notNull(),
  status: planStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const mealPlanItem = pgTable(
  "meal_plan_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mealPlanId: uuid("meal_plan_id")
      .notNull()
      .references(() => mealPlan.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    plannedServings: integer("planned_servings").notNull().default(2),
  },
  (t) => [index("meal_plan_item_plan_idx").on(t.mealPlanId)],
);

export const shoppingList = pgTable("shopping_list", {
  id: uuid("id").primaryKey().defaultRandom(),
  mealPlanId: uuid("meal_plan_id")
    .notNull()
    .references(() => mealPlan.id, { onDelete: "cascade" }),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const shoppingListItem = pgTable(
  "shopping_list_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shoppingListId: uuid("shopping_list_id")
      .notNull()
      .references(() => shoppingList.id, { onDelete: "cascade" }),
    canonicalName: text("canonical_name").notNull(),
    aisle: text("aisle"),
    displayText: text("display_text").notNull(), // "Chicken breast — 200 g + 2 whole"
    totalQuantity: doublePrecision("total_quantity"),
    baseUnit: text("base_unit"),
    unitCategory: unitCategoryEnum("unit_category").notNull().default("unknown"),
    isSummable: boolean("is_summable").notNull().default(true),
    isChecked: boolean("is_checked").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("shopping_list_item_list_idx").on(t.shoppingListId)],
);

// ---------------------------------------------------------------------------
// Import jobs — async ingestion pipeline
// ---------------------------------------------------------------------------

export const importJob = pgTable(
  "import_job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerEmail: text("owner_email").notNull(),
    batchId: uuid("batch_id"), // groups items from one bulk import
    sourceType: sourceTypeEnum("source_type").notNull(),
    label: text("label"), // short human label e.g. the URL or first line
    rawInput: text("raw_input").notNull(), // url, pasted text, or image ref
    status: importStatusEnum("status").notNull().default("pending"),
    error: text("error"),
    recipeId: uuid("recipe_id").references(() => recipe.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("import_job_owner_idx").on(t.ownerEmail),
    index("import_job_batch_idx").on(t.batchId),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const recipeRelations = relations(recipe, ({ many }) => ({
  ingredients: many(recipeIngredient),
  steps: many(step),
  recipeTags: many(recipeTag),
}));

export const recipeIngredientRelations = relations(
  recipeIngredient,
  ({ one }) => ({
    recipe: one(recipe, {
      fields: [recipeIngredient.recipeId],
      references: [recipe.id],
    }),
    canonical: one(canonicalIngredient, {
      fields: [recipeIngredient.canonicalIngredientId],
      references: [canonicalIngredient.id],
    }),
  }),
);

export const stepRelations = relations(step, ({ one }) => ({
  recipe: one(recipe, { fields: [step.recipeId], references: [recipe.id] }),
}));

export const recipeTagRelations = relations(recipeTag, ({ one }) => ({
  recipe: one(recipe, { fields: [recipeTag.recipeId], references: [recipe.id] }),
  tag: one(tag, { fields: [recipeTag.tagId], references: [tag.id] }),
}));

export const mealPlanRelations = relations(mealPlan, ({ many }) => ({
  items: many(mealPlanItem),
}));

export const mealPlanItemRelations = relations(mealPlanItem, ({ one }) => ({
  plan: one(mealPlan, {
    fields: [mealPlanItem.mealPlanId],
    references: [mealPlan.id],
  }),
  recipe: one(recipe, {
    fields: [mealPlanItem.recipeId],
    references: [recipe.id],
  }),
}));

export const shoppingListRelations = relations(shoppingList, ({ many }) => ({
  items: many(shoppingListItem),
}));

export const shoppingListItemRelations = relations(
  shoppingListItem,
  ({ one }) => ({
    list: one(shoppingList, {
      fields: [shoppingListItem.shoppingListId],
      references: [shoppingList.id],
    }),
  }),
);

// Convenient inferred types
export type Recipe = typeof recipe.$inferSelect;
export type NewRecipe = typeof recipe.$inferInsert;
export type UserProfile = typeof userProfile.$inferSelect;
export type RecipeIngredient = typeof recipeIngredient.$inferSelect;
export type Step = typeof step.$inferSelect;
export type MealPlan = typeof mealPlan.$inferSelect;
export type MealPlanItem = typeof mealPlanItem.$inferSelect;
export type ShoppingListItem = typeof shoppingListItem.$inferSelect;
export type ImportJob = typeof importJob.$inferSelect;
