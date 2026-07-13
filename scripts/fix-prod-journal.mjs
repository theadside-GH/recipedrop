// One-shot repair of drizzle.__drizzle_migrations on the production DB:
// replace the six fabricated future created_at values with the real git
// dates now recorded in drizzle/meta/_journal.json, so pending migrations
// are no longer mistaken for already-applied ones.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const envLocal = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = envLocal.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("No DATABASE_URL in .env.local");

const remap = [
  [1783990800000, 1783619685000], // 0006
  [1784005200000, 1783624147000], // 0007
  [1784091600000, 1783690804000], // 0008
  [1784178000000, 1783696789000], // 0009
  [1784264400000, 1783698727000], // 0010
  [1784350800000, 1783704783000], // 0011
  [1784350800001, 1783723730901], // 0012 — undo the temporary outranking bump
];

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
try {
  for (const [oldTs, newTs] of remap) {
    const r = await sql`
      update drizzle.__drizzle_migrations set created_at = ${newTs}
      where created_at = ${oldTs}`;
    console.log(`created_at ${oldTs} -> ${newTs}: ${r.count} row(s)`);
  }
  const rows = await sql`
    select id, created_at from drizzle.__drizzle_migrations order by id`;
  console.log(
    rows
      .map((r) => `id=${r.id} ${new Date(Number(r.created_at)).toISOString()}`)
      .join("\n"),
  );
} finally {
  await sql.end();
}
