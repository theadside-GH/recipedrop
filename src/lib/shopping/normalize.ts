/**
 * Canonical comparison key for ingredient names.
 *
 * Recipe canonical names are singular by convention (the AI prompt enforces
 * "egg", "chicken breast"), but pantry entries, the common-staples picker,
 * and hand-typed shopping items arrive in natural plural ("eggs", "chicken
 * breasts"). Every match in the app is string equality, so both sides must
 * funnel through this key before comparing — never compare raw names.
 *
 * Deliberately naive: singularizes only the final word with a few English
 * rules. Both sides of every comparison use the same key, so even an
 * "incorrect" singular ("oats" → "oat") still matches itself.
 */
export function ingredientMatchKey(value: string | null | undefined): string {
  const cleaned = (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const words = cleaned.split(" ");
  words[words.length - 1] = singularize(words[words.length - 1]);
  return words.join(" ");
}

function singularize(word: string): string {
  if (word.length <= 3) return word; // "gas", "was" — too short to guess
  if (/(ss|sses|us|is)$/.test(word)) return word; // molasses, hummus, asparagus
  if (/ies$/.test(word) && word.length > 4) return word.slice(0, -3) + "y"; // berries → berry
  if (/(oes|ches|shes|xes|zes)$/.test(word)) return word.slice(0, -2); // tomatoes → tomato
  if (word.endsWith("s")) return word.slice(0, -1); // eggs → egg
  return word;
}
