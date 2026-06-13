/** Best-effort grocery aisle for a canonical ingredient name (keyword match). */
const AISLE_RULES: { aisle: string; words: string[] }[] = [
  { aisle: "Produce", words: ["apple", "banana", "lettuce", "onion", "garlic", "tomato", "potato", "carrot", "pepper", "cilantro", "parsley", "basil", "spinach", "lemon", "lime", "avocado", "cucumber", "celery", "mushroom", "ginger", "lettuce", "kale", "broccoli", "zucchini", "berry", "berries", "herb", "scallion", "leek", "cabbage", "corn"] },
  { aisle: "Meat & Seafood", words: ["chicken", "beef", "pork", "bacon", "sausage", "turkey", "lamb", "shrimp", "salmon", "fish", "steak", "ground", "tuna", "cod"] },
  { aisle: "Dairy & Eggs", words: ["milk", "butter", "cheese", "cream", "yogurt", "egg", "parmesan", "mozzarella", "feta", "ricotta"] },
  { aisle: "Bakery", words: ["bread", "bun", "tortilla", "bagel", "roll", "baguette", "pita", "naan"] },
  { aisle: "Pantry", words: ["flour", "sugar", "rice", "pasta", "oil", "vinegar", "sauce", "salt", "pepper", "spice", "broth", "stock", "bean", "lentil", "tomato paste", "canned", "honey", "syrup", "vanilla", "baking", "yeast", "oats", "noodle", "soy", "cumin", "paprika", "cinnamon", "oregano", "chili"] },
  { aisle: "Frozen", words: ["frozen", "ice cream", "pea"] },
  { aisle: "Beverages", words: ["water", "juice", "wine", "beer", "soda", "coffee", "tea"] },
];

export function guessAisle(canonicalName: string): string | null {
  const n = canonicalName.toLowerCase();
  for (const rule of AISLE_RULES) {
    if (rule.words.some((w) => n.includes(w))) return rule.aisle;
  }
  return null;
}
