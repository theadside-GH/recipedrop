/**
 * One-time backfill: populate recipe.source_key for rows created before the
 * column existed, so public listings can group the same link dropped by
 * different people. Requires migration 0009 (npm run db:migrate) first.
 *
 * Run: npm run backfill:source-keys
 * Uses DATABASE_URL from .env.local, so against the configured (production)
 * database. Safe to re-run; recomputes the key from source_url every time.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { and, eq, isNotNull, isNull } = await import("drizzle-orm");
  const { getDb, schema } = await import("../src/lib/db");
  const { resolveSourceKey } = await import("../src/lib/import/resolve-source");

  const db = await getDb();
  const rows = await db
    .select({ id: schema.recipe.id, title: schema.recipe.title, sourceUrl: schema.recipe.sourceUrl })
    .from(schema.recipe)
    .where(isNotNull(schema.recipe.sourceUrl));
  console.log(`Computing source keys for ${rows.length} recipe${rows.length === 1 ? "" : "s"}...\n`);

  let keyed = 0;
  let unkeyable = 0;
  for (const row of rows) {
    // Resolves per-share short links (tiktok.com/t/...) to the canonical
    // video URL, so the same video shared by different people groups.
    const key = await resolveSourceKey(row.sourceUrl);
    if (key) {
      await db.update(schema.recipe).set({ sourceKey: key }).where(eq(schema.recipe.id, row.id));
      keyed += 1;
      console.log(`KEYED    ${row.title.slice(0, 48)} -> ${key.slice(0, 70)}`);
    } else {
      unkeyable += 1;
      console.log(`SKIP     ${row.title.slice(0, 48)} (source is not an http URL)`);
    }
  }

  console.log(`\nDone: ${keyed} keyed, ${unkeyable} skipped.`);

  // Second pass: recipes created before saved_from_email existed. Best-effort
  // heuristic — a later drop of a link someone else dropped first was almost
  // certainly saved from (or at least discovered via) that original drop.
  // Going forward, saveDropForOwner records this exactly at save time.
  const all = await db
    .select({
      id: schema.recipe.id,
      ownerEmail: schema.recipe.ownerEmail,
      sourceKey: schema.recipe.sourceKey,
      createdAt: schema.recipe.createdAt,
      savedFromEmail: schema.recipe.savedFromEmail,
    })
    .from(schema.recipe)
    .where(and(isNotNull(schema.recipe.sourceKey), isNull(schema.recipe.savedFromEmail)))
    .orderBy(schema.recipe.createdAt);
  const byKey = new Map<string, typeof all>();
  for (const row of all) {
    const list = byKey.get(row.sourceKey as string) ?? [];
    list.push(row);
    byKey.set(row.sourceKey as string, list);
  }
  let marked = 0;
  for (const rows of byKey.values()) {
    const original = rows[0];
    for (const later of rows.slice(1)) {
      if (later.ownerEmail === original.ownerEmail) continue;
      await db
        .update(schema.recipe)
        .set({ savedFromEmail: original.ownerEmail })
        .where(eq(schema.recipe.id, later.id));
      marked += 1;
    }
  }
  if (marked > 0) console.log(`Marked ${marked} pre-existing cop${marked === 1 ? "y" : "ies"} as saved-from-another-cook.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
