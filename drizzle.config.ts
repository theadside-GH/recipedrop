import type { Config } from "drizzle-kit";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

/**
 * Drizzle Kit config. Dialect is always Postgres (works for both the local
 * PGlite database and the production Supabase Postgres). Migrations are
 * generated into ./drizzle and applied automatically to PGlite at boot, or to
 * Supabase via `npm run db:migrate`.
 */
export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/placeholder",
  },
} satisfies Config;
