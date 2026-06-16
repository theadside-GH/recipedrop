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

function cleanHandle(value: string | null | undefined): string | null {
  const cleaned = value
    ?.toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24)
    .trim();
  return cleaned || null;
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
  if (existing) return existing;

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
  await getOrCreateProfile(email);
  const [updated] = await db
    .update(userProfile)
    .set({
      displayName: input.displayName.trim() || defaultName(email),
      handle: cleanHandle(input.handle),
      avatarUrl: cleanOptional(input.avatarUrl),
      bio: cleanOptional(input.bio),
      publicFeedOptIn: input.publicFeedOptIn,
      updatedAt: new Date(),
    })
    .where(eq(userProfile.email, email))
    .returning();
  return updated;
}
