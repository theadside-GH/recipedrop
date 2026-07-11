import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

loadEnvConfig(process.cwd());

const required = [
  "ANTHROPIC_API_KEY",
  "OWNER_EMAIL",
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const missing = required.filter((key) => !process.env[key]?.trim());
const placeholderOwner = process.env.OWNER_EMAIL === "you@example.com";

async function checkDatabase() {
  const sql = postgres(process.env.DATABASE_URL ?? "", {
    prepare: false,
    connect_timeout: 10,
  });

  try {
    await sql`select 1`;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Database connection failed.");
    console.error(detail);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function main() {
  if (missing.length > 0 || placeholderOwner) {
    console.error("DishCovered is not ready for hosted deployment yet.");
    if (missing.length > 0) {
      console.error(`Missing: ${missing.join(", ")}`);
    }
    if (placeholderOwner) {
      console.error("OWNER_EMAIL is still set to the example address.");
    }
    console.error("Set these in your host, then run this check again.");
    process.exitCode = 1;
  } else {
    await checkDatabase();
    if (!process.exitCode) {
      console.log("DishCovered deployment environment looks ready.");
    }
  }
}

void main();
