/**
 * Backfill: make sure every recipe has a photo that keeps working.
 *
 * Recipes used to store remote image URLs. Most recipe photos live on signed
 * social CDNs (TikTok/Instagram) whose URLs expire within days, so a URL that
 * validated at import time goes dead later. This script converts every
 * remote-URL photo into an embedded data: URL snapshot: if the stored URL
 * still loads, its bytes are saved directly; if it's dead or missing, a
 * stand-in is found by dish title (AI web search) and saved. Owners can
 * replace any photo from the recipe's Edit page.
 *
 * Run: npm run backfill:images
 * Uses DATABASE_URL + ANTHROPIC_API_KEY from .env.local, so against the
 * configured (production) database. Safe to re-run; recipes already holding
 * embedded (data:) photos are skipped.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { eq } = await import("drizzle-orm");
  const { getDb, schema } = await import("../src/lib/db");
  const { features } = await import("../src/lib/env");
  const { imageUrlToDataUrl } = await import("../src/lib/import/images");
  const { findStandInImage } = await import("../src/lib/ai/image-search");

  if (!features.aiEnabled) {
    console.warn("ANTHROPIC_API_KEY is not set — can embed live photos but not find stand-ins.");
  }

  const db = await getDb();
  const rows = await db
    .select({ id: schema.recipe.id, title: schema.recipe.title, imagePath: schema.recipe.imagePath })
    .from(schema.recipe)
    .orderBy(schema.recipe.createdAt);
  console.log(`Checking ${rows.length} recipe${rows.length === 1 ? "" : "s"}...\n`);

  let ok = 0;
  let embedded = 0;
  let standIns = 0;
  let failed = 0;
  for (const row of rows) {
    const label = row.title.slice(0, 48);

    // Already an embedded snapshot (uploaded or previously backfilled) — durable.
    if (row.imagePath?.startsWith("data:")) {
      ok += 1;
      console.log(`ok       ${label} (embedded photo)`);
      continue;
    }

    // Remote URL that still loads: embed its bytes before the URL rots.
    if (row.imagePath) {
      const snapshot = await imageUrlToDataUrl(row.imagePath);
      if (snapshot) {
        await db.update(schema.recipe).set({ imagePath: snapshot }).where(eq(schema.recipe.id, row.id));
        embedded += 1;
        console.log(`EMBEDDED ${label} (${Math.round(snapshot.length / 1024)}kB from live URL)`);
        continue;
      }
    }

    const reason = row.imagePath ? "dead URL" : "missing";
    if (!features.aiEnabled) {
      failed += 1;
      console.log(`SKIP     ${label} (photo ${reason}; no API key for stand-in search)`);
      continue;
    }
    const standIn = await findStandInImage(row.title);
    if (standIn) {
      await db.update(schema.recipe).set({ imagePath: standIn }).where(eq(schema.recipe.id, row.id));
      standIns += 1;
      console.log(`STAND-IN ${label} (was ${reason}; ${Math.round(standIn.length / 1024)}kB)`);
    } else {
      failed += 1;
      console.log(`NO MATCH ${label} (photo ${reason}; search found nothing usable)`);
    }
  }

  console.log(
    `\nDone: ${ok} already embedded, ${embedded} embedded from live URLs, ${standIns} stand-ins found, ${failed} still without a photo.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
