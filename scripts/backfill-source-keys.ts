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
  const { eq, isNotNull } = await import("drizzle-orm");
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
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
