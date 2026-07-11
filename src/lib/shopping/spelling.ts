/**
 * "Did you mean…?" for hand-typed pantry items. Pantry names only ever match
 * shopping-list lines by exact string, so a typo ("chiken") silently fails to
 * cross anything off. This suggests the closest ingredient the app already
 * knows so the user can accept it before saving.
 *
 * Deliberately conservative: near-misses only. "chicken thigh" and
 * "chicken breast" are different groceries and must never suggest each other.
 */

/** Classic Levenshtein edit distance, capped — we only care about tiny edits. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function allowedDistance(length: number): number {
  if (length <= 4) return 1;
  return 2;
}

/**
 * The closest known ingredient name to what the user typed, or null when the
 * input is already known (or nothing is close enough to be a likely typo).
 */
export function closestKnownName(input: string, known: string[]): string | null {
  const typed = input.trim().toLowerCase();
  if (typed.length < 3) return null;
  const max = allowedDistance(typed.length);
  let best: string | null = null;
  let bestDistance = max + 1;
  for (const candidate of known) {
    const name = candidate.trim().toLowerCase();
    if (name === typed) return null; // already a known ingredient — no prompt
    const distance = editDistance(typed, name, max);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = name;
    }
  }
  return bestDistance <= max ? best : null;
}
