// Temporary read-only diagnostic: run with `node scripts/db-doctor.mjs`.
// Answers three questions about the DATABASE_URL database in .env.local:
// 1. Does shopping_list_item.is_custom exist?
// 2. What does the drizzle migration journal claim was applied?
// 3. Does the meal plan id from the production error logs exist here?
import { readFileSync } from "node:fs";
import postgres from "postgres";

const envLocal = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = envLocal.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("No DATABASE_URL in env");
  process.exit(1);
}
console.log("host:", new URL(url).host, "user:", new URL(url).username);

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
try {
  const col = await sql`
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shopping_list_item' and column_name = 'is_custom'`;
  console.log("1. is_custom column exists:", col.length > 0);

  const journal = await sql`
    select id, hash, created_at from drizzle.__drizzle_migrations order by id`;
  console.log(`2. journal entries: ${journal.length}`);
  for (const j of journal.slice(-4)) {
    console.log(`   id=${j.id} created_at=${new Date(Number(j.created_at)).toISOString()} hash=${j.hash.slice(0, 12)}...`);
  }

  const plan = await sql`
    select id, name, created_at from meal_plan where id = ${"99bc4acf-0779-4904-8e62-6d299aaf9433"}`;
  console.log("3. plan id from prod error logs exists here:", plan.length > 0, plan[0]?.name ?? "");
} finally {
  await sql.end();
}
