import "server-only";
import { getDb } from "@/lib/db";
import { proWaitlist } from "@/lib/db/schema";

/** Record interest in Pro billing. Idempotent on email. */
export async function joinProWaitlist(email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!clean || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
    throw new Error("Enter a valid email address.");
  }
  const db = await getDb();
  await db.insert(proWaitlist).values({ email: clean }).onConflictDoNothing();
}
