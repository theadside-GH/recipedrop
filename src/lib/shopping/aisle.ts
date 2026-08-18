/**
 * Best-effort grocery aisle for a canonical ingredient name.
 *
 * Matches the MOST SPECIFIC (longest) keyword across every aisle, so a spice
 * or pantry form beats a look-alike produce/dairy word:
 *   "black pepper"  → Pantry  (not Produce's "pepper")
 *   "peanut butter" → Pantry  (not Dairy's "butter")
 *   "tomato paste"  → Pantry  (not Produce's "tomato")
 *   "ground cumin"  → Pantry  (bare "ground" is no longer a Meat keyword)
 * On a length tie, the earlier rule wins, so rule order is the priority.
 */
const AISLE_RULES: { aisle: string; words: string[] }[] = [
  {
    aisle: "Produce",
    words: [
      "apple", "banana", "lettuce", "onion", "garlic", "tomato", "potato", "carrot",
      "bell pepper", "jalapeno", "cilantro", "parsley", "basil", "spinach", "lemon",
      "lime", "avocado", "cucumber", "celery", "mushroom", "kale", "broccoli",
      "zucchini", "berry", "berries", "herb", "scallion", "green onion", "leek",
      "cabbage", "corn", "pepper", "ginger", "pea",
    ],
  },
  {
    aisle: "Meat & Seafood",
    // No bare "ground": "ground cumin/coriander" are spices, and "ground
    // beef/pork/turkey" are caught by their meat word or the explicit phrase.
    words: [
      "chicken", "beef", "pork", "bacon", "sausage", "turkey", "lamb", "shrimp",
      "salmon", "fish", "steak", "tuna", "cod", "ground beef", "ground pork",
      "ground turkey",
    ],
  },
  {
    aisle: "Dairy & Eggs",
    words: [
      "milk", "butter", "cheese", "cream", "yogurt", "egg", "parmesan",
      "mozzarella", "feta", "ricotta",
    ],
  },
  {
    aisle: "Bakery",
    words: ["bread", "bun", "tortilla", "bagel", "roll", "baguette", "pita", "naan"],
  },
  {
    aisle: "Pantry",
    words: [
      "flour", "sugar", "rice", "pasta", "oil", "vinegar", "sauce", "salt",
      "black pepper", "white pepper", "peppercorn", "red pepper", "cayenne",
      "spice", "broth", "stock", "bean", "lentil", "tomato paste", "tomato sauce",
      "canned", "honey", "syrup", "corn syrup", "cornstarch", "corn flour", "cornmeal",
      "vanilla", "baking", "yeast", "oats", "noodle", "soy", "cumin",
      "ground cumin", "paprika", "cinnamon", "ground cinnamon", "oregano", "chili",
      "peanut butter", "almond butter", "cashew butter", "nut butter",
    ],
  },
  { aisle: "Frozen", words: ["frozen", "ice cream"] },
  { aisle: "Beverages", words: ["water", "juice", "wine", "beer", "soda", "coffee", "tea"] },
];

/** Store-walk display order; anything unmatched sorts last as "Other". */
export const AISLE_ORDER = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Frozen",
  "Pantry",
  "Beverages",
  "Other",
];

export function guessAisle(canonicalName: string): string | null {
  // Fold accents so "jalapeño" still hits the "jalapeno" keyword.
  const n = canonicalName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let bestAisle: string | null = null;
  let bestLen = 0;
  for (const rule of AISLE_RULES) {
    for (const word of rule.words) {
      // Longer match wins; ties keep the earlier (higher-priority) rule.
      if (word.length > bestLen && n.includes(word)) {
        bestLen = word.length;
        bestAisle = rule.aisle;
      }
    }
  }
  return bestAisle;
}

/** Sort key for grocery aisles in store-walk order. */
export function aisleRank(aisle: string | null): number {
  const idx = AISLE_ORDER.indexOf(aisle ?? "Other");
  return idx === -1 ? AISLE_ORDER.length : idx;
}
