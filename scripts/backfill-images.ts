/**
 * One-time backfill: make sure every recipe has a photo that actually loads.
 *
 * For each recipe, verify the current image still works; when it's missing or
 * dead, find a stand-in by dish title (AI web search + validation) and save
 * it. Owners can replace any photo from the recipe's Edit page.
 *
 * Run: npm run backfill:images
 * Uses DATABASE_URL + ANTHROPIC_API_KEY from .env.local, so against the
 * configured (production) database. Safe to re-run; it only touches recipes
 * whose photo is missing or broken.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { eq } = await import("drizzle-orm");
  const { getDb, schema } = await import("../src/lib/db");
  const { features } = await import("../src/lib/env");
  const { pickWorkingImage } = await import("../src/lib/import/images");
  const { findStandInImage } = await import("../src/lib/ai/image-search");

  if (!features.aiEnabled) {
    console.warn("ANTHROPIC_API_KEY is not set — can verify photos but not find stand-ins.");
  }

  const db = await getDb();
  const rows = await db
    .select({ id: schema.recipe.id, title: schema.recipe.title, imagePath: schema.recipe.imagePath })
    .from(schema.recipe)
    .orderBy(schema.recipe.createdAt);
  console.log(`Checking ${rows.length} recipe${rows.length === 1 ? "" : "s"}...\n`);

  let ok = 0;
  let fixed = 0;
  let failed = 0;
  for (const row of rows) {
    const label = `${row.title.slice(0, 48)}`;

    // Uploaded/embedded images are stored as data: URLs — always fine.
    if (row.imagePath?.startsWith("data:")) {
      ok += 1;
      console.log(`ok       ${label} (uploaded photo)`);
      continue;
    }
    if (row.imagePath && (await pickWorkingImage([row.imagePath]))) {
      ok += 1;
      console.log(`ok       ${label}`);
      continue;
    }

    const reason = row.imagePath ? "broken" : "missing";
    if (!features.aiEnabled) {
      failed += 1;
      console.log(`SKIP     ${label} (photo ${reason}; no API key for stand-in search)`);
      continue;
    }
    const standIn = await findStandInImage(row.title);
    if (standIn) {
      await db.update(schema.recipe).set({ imagePath: standIn }).where(eq(schema.recipe.id, row.id));
      fixed += 1;
      console.log(`FIXED    ${label} (was ${reason}) -> ${standIn.slice(0, 80)}`);
    } else {
      failed += 1;
      console.log(`NO MATCH ${label} (photo ${reason}; search found nothing usable)`);
    }
  }

  console.log(`\nDone: ${ok} already fine, ${fixed} fixed, ${failed} still without a photo.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
