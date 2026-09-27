/**
 * Dietary tags the extraction model adds that the ingredient list contradicts
 * ("vegetarian" on a curry with fish sauce). A wrong vegan/vegetarian tag is a
 * trust problem, not a cosmetic one, and the model keeps doing it despite the
 * prompt — so strip contradicted tags deterministically. Only removes tags;
 * never adds them.
 */
const MEAT_OR_FISH =
  /\b(beef|pork|lamb|mutton|veal|chicken|turkey|duck|goose|bacon|ham|prosciutto|pancetta|salami|pepperoni|chorizo|sausage|steak|brisket|gelatin|lard|suet|fish|anchovy|anchovies|salmon|tuna|cod|shrimp|prawn|crab|lobster|clam|mussel|oyster|scallop|squid|octopus|bonito|dashi|worcestershire)s?\b/;
const DAIRY =
  /\b(milk|butter|buttermilk|cream|cheese|yogurt|yoghurt|ghee|whey|parmesan|mozzarella|ricotta|feta|mascarpone)\b/;
const OTHER_ANIMAL = /\b(egg|eggs|honey|mayonnaise|mayo)\b/;
const GLUTEN =
  /\b(flour|bread|breadcrumbs?|panko|pasta|spaghetti|noodles?|couscous|barley|rye|wheat|semolina|soy sauce|beer|tortillas?|pita|crackers?)\b/;

// Plant or free-from versions don't count against a tag.
const NOT_ANIMAL =
  /\b(vegan|plant[- ]based|dairy[- ]free|non[- ]dairy|coconut|almond|oat|soy|cashew|peanut|nut|apple|cocoa|shea|tartar|egg[- ]free)\b/;
const NOT_GLUTEN = /\b(gluten[- ]free|rice|almond|coconut|chickpea|corn|buckwheat|tapioca|potato)\b/;

export function dropContradictedDietaryTags(tags: string[], ingredientNames: string[]): string[] {
  const names = ingredientNames.map((name) => name.toLowerCase());
  const has = (pattern: RegExp, except: RegExp) =>
    names.some((name) => pattern.test(name) && !except.test(name));
  const meat = has(MEAT_OR_FISH, NOT_ANIMAL);
  const dairy = has(DAIRY, NOT_ANIMAL);
  const animal = meat || dairy || has(OTHER_ANIMAL, NOT_ANIMAL);
  return tags.filter((tag) => {
    switch (tag.toLowerCase().trim().replace(/[\s_]+/g, "-")) {
      case "vegetarian":
        return !meat;
      case "vegan":
      case "plant-based":
        return !animal;
      case "dairy-free":
        return !dairy;
      case "gluten-free":
        return !has(GLUTEN, NOT_GLUTEN);
      default:
        return true;
    }
  });
}
