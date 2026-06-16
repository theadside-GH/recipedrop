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
    const client = postgres(env.databaseUrl, {
      prepare: false,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    return drizzle(client, { schema }) as unknown as DB;
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
    globalThis.__scDbPromise = init();
  }
  return globalThis.__scDbPromise;
}

export { schema };
