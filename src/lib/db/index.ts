import "server-only";
import * as schema from "./schema";
import { env, features } from "@/lib/env";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * A single DB type used across the app. Both the PGlite (local) and postgres-js
 * (Supabase) drivers expose the query-builder surface we use, so we expose one
 * unified type and switch the underlying driver based on env.
 */
export type DB = PostgresJsDatabase<typeof schema>;

declare global {
  var __scDbPromise: Promise<DB> | undefined;
}

async function init(): Promise<DB> {
  if (features.usePostgres) {
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    // max > 1 so a page's Promise.all query fan-out actually runs in parallel
    // and one slow import transaction can't serialize every other request on
    // the instance. Pool size must match the pooler MODE, discovered live via
    // EMAXCONNSESSION: Supabase's session pooler (port 5432) dedicates one of
    // only ~15 clients per connection — a few warm instances at max 8
    // exhausted it and 500'd signed-in pages. Transaction mode (port 6543,
    // with prepare: false) multiplexes, so max 8 is safe there. Prefer the
    // 6543 URL in production; this guard keeps session-mode URLs alive.
    const sessionMode = /:5432\//.test(env.databaseUrl);
    const client = postgres(env.databaseUrl, {
      prepare: false,
      max: sessionMode ? 2 : 8,
      idle_timeout: sessionMode ? 5 : 20,
      connect_timeout: 10,
    });
    return drizzle(client, { schema }) as unknown as DB;
  }

  // The PGlite fallback is a dev convenience only. On Vercel it would boot
  // "green" and silently write user data to an ephemeral per-instance disk —
  // unrecoverable. If DATABASE_URL ever goes missing in a deploy (env not
  // copied on a project move, typo'd var), fail every request loudly instead.
  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is not set on this deployment — refusing to start the embedded fallback database in production.",
    );
  }

  // Local zero-setup embedded Postgres (PGlite), persisted to disk.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(env.pgliteDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db as unknown as DB;
}

/** Get the shared database instance (lazily initialized + memoized). */
export function getDb(): Promise<DB> {
  if (!globalThis.__scDbPromise) {
    // A failed init must not be memoized: one transient connect error would
    // otherwise leave this instance returning the same rejection for every
    // request until the process is recycled.
    globalThis.__scDbPromise = init().catch((err) => {
      globalThis.__scDbPromise = undefined;
      throw err;
    });
  }
  return globalThis.__scDbPromise;
}

export { schema };
