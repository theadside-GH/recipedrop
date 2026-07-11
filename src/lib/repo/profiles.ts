import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userProfile } from "@/lib/db/schema";

export interface ProfileInput {
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  bio: string | null;
  publicFeedOptIn: boolean;
}

export interface ProfileSeed {
  displayName?: string | null;
  avatarUrl?: string | null;
}

function defaultName(email: string) {
  const local = email.split("@")[0] || "RecipeDrop user";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Handles that would collide with routes or read as official.
const RESERVED_HANDLES = new Set([
  "admin",
  "administrator",
  "recipedrop",
  "official",
  "support",
  "help",
  "about",
  "login",
  "discover",
  "recipes",
  "import",
  "plans",
  "pantry",
  "profile",
  "collections",
  "api",
]);

function cleanHandle(value: string | null | undefined): string | null {
  const cleaned = value
    ?.toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24)
    .trim();
  if (cleaned && RESERVED_HANDLES.has(cleaned)) {
    throw new Error("That username is reserved — pick another.");
  }
  return cleaned || null;
}

/** Postgres 23505: unique constraint (someone else owns that handle). */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

function cleanOptional(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export async function getOrCreateProfile(email: string, seed: ProfileSeed = {}) {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.email, email))
    .limit(1);
  if (existing) {
    if (!existing.avatarUrl && seed.avatarUrl) {
      const [updated] = await db
        .update(userProfile)
        .set({
          avatarUrl: cleanOptional(seed.avatarUrl),
          displayName:
            existing.displayName || seed.displayName?.trim() || defaultName(email),
          updatedAt: new Date(),
        })
        .where(eq(userProfile.email, email))
        .returning();
      return updated;
    }
    return existing;
  }

  const [created] = await db
    .insert(userProfile)
    .values({
      email,
      displayName: seed.displayName?.trim() || defaultName(email),
      avatarUrl: cleanOptional(seed.avatarUrl),
    })
    .returning();
  return created;
}

export async function updateProfile(email: string, input: ProfileInput) {
  const db = await getDb();
  const existing = await getOrCreateProfile(email);
  const nextHandle = cleanHandle(input.handle);
  const handleChanged = (existing.handle ?? null) !== nextHandle;
  if (handleChanged && existing.handle && existing.handleChangedAt) {
    throw new Error("Username can only be changed once.");
  }
  try {
    const [updated] = await db
      .update(userProfile)
      .set({
        displayName: input.displayName.trim() || defaultName(email),
        handle: nextHandle,
        handleChangedAt:
          handleChanged && existing.handle && !existing.handleChangedAt
            ? new Date()
            : existing.handleChangedAt,
        avatarUrl: cleanOptional(input.avatarUrl),
        bio: cleanOptional(input.bio),
        publicFeedOptIn: input.publicFeedOptIn,
        updatedAt: new Date(),
      })
      .where(eq(userProfile.email, email))
      .returning();
    return updated;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new Error("That username is already taken — try another.");
    }
    throw err;
  }
}
