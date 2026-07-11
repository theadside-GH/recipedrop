/**
 * One-time migration: move embedded (data:) photos out of the database and
 * into Supabase Storage, replacing each imagePath/avatarUrl with the hosted
 * CDN URL. This is what shrinks Discover from ~5 MB of inlined base64 to a
 * page of small cached image links.
 *
 * Safety: a row is only updated after the uploaded URL is fetched back and
 * confirmed to serve an image — otherwise the embedded copy stays put.
 * Safe to re-run: rows already holding http(s) URLs are skipped.
 *
 * Run: npm run migrate:images
 * Needs DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY
 * in .env.local (runs against the configured — production — database).
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { eq } = await import("drizzle-orm");
  const { getDb, schema } = await import("../src/lib/db");
  const { features } = await import("../src/lib/env");
  const { uploadImageBytes } = await import("../src/lib/storage");

  if (!features.storageEnabled) {
    console.error(
      "Storage is not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.",
    );
    process.exit(1);
  }

  const db = await getDb();

  async function hostDataUrl(dataUrl: string): Promise<string | null> {
    const match = dataUrl.match(/^data:(image\/[\w.+-]+);base64,([\s\S]+)$/);
    if (!match) return null;
    const url = await uploadImageBytes(Buffer.from(match[2], "base64"), match[1]);
    if (!url) return null;
    // Verify the hosted copy actually serves before touching the row.
    const check = await fetch(url, { method: "HEAD" });
    if (!check.ok || !(check.headers.get("content-type") ?? "").startsWith("image/")) {
      return null;
    }
    return url;
  }

  // --- Recipes ---------------------------------------------------------------
  const recipes = await db
    .select({ id: schema.recipe.id, title: schema.recipe.title, imagePath: schema.recipe.imagePath })
    .from(schema.recipe)
    .orderBy(schema.recipe.createdAt);

  let moved = 0;
  let skipped = 0;
  let failed = 0;
  let bytesFreed = 0;
  console.log(`Checking ${recipes.length} recipe photo${recipes.length === 1 ? "" : "s"}...\n`);
  for (const row of recipes) {
    const label = row.title.slice(0, 48);
    if (!row.imagePath?.startsWith("data:")) {
      skipped += 1;
      continue;
    }
    const hosted = await hostDataUrl(row.imagePath);
    if (!hosted) {
      failed += 1;
      console.log(`FAILED   ${label} (upload or verify failed; embedded copy kept)`);
      continue;
    }
    await db
      .update(schema.recipe)
      .set({ imagePath: hosted })
      .where(eq(schema.recipe.id, row.id));
    moved += 1;
    bytesFreed += row.imagePath.length;
    console.log(`HOSTED   ${label} (${Math.round(row.imagePath.length / 1024)} kB → URL)`);
  }

  // --- Avatars ---------------------------------------------------------------
  const profiles = await db
    .select({ email: schema.userProfile.email, avatarUrl: schema.userProfile.avatarUrl })
    .from(schema.userProfile);
  let avatarsMoved = 0;
  for (const profile of profiles) {
    if (!profile.avatarUrl?.startsWith("data:")) continue;
    const hosted = await hostDataUrl(profile.avatarUrl);
    if (!hosted) {
      failed += 1;
      console.log(`FAILED   avatar for ${profile.email} (embedded copy kept)`);
      continue;
    }
    bytesFreed += profile.avatarUrl.length;
    await db
      .update(schema.userProfile)
      .set({ avatarUrl: hosted, updatedAt: new Date() })
      .where(eq(schema.userProfile.email, profile.email));
    avatarsMoved += 1;
    console.log(`HOSTED   avatar for ${profile.email}`);
  }

  console.log(
    `\nDone: ${moved} recipe photos + ${avatarsMoved} avatars moved to storage, ` +
      `${skipped} already fine, ${failed} failed (embedded copies kept). ` +
      `~${(bytesFreed / 1024 / 1024).toFixed(1)} MB removed from database rows.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
