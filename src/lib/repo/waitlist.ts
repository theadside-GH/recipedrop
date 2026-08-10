import "server-only";
import { getDb } from "@/lib/db";
import { inviteRequest, proWaitlist } from "@/lib/db/schema";

function validEmail(email: string): string {
  const clean = email.trim().toLowerCase();
  if (!clean || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
    throw new Error("Enter a valid email address.");
  }
  return clean;
}

/** Record interest in Pro billing. Idempotent on email. */
export async function joinProWaitlist(email: string): Promise<void> {
  const db = await getDb();
  await db.insert(proWaitlist).values({ email: validEmail(email) }).onConflictDoNothing();
}

/** Record an access request from a signed-in, uninvited account. Idempotent. */
export async function requestInvite(email: string): Promise<void> {
  const db = await getDb();
  await db.insert(inviteRequest).values({ email: validEmail(email) }).onConflictDoNothing();
}
