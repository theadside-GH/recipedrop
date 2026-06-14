import "server-only";
import { and, eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { importJob } from "@/lib/db/schema";
import { splitBulkInput, detectSourceType } from "@/lib/sources/detect";
import type { SourceType } from "@/lib/sources/types";
import { randomUUID } from "node:crypto";

export type ImportJobRow = typeof importJob.$inferSelect;

const MAX_BULK_ITEMS = 20;

function labelFor(type: SourceType, value: string): string {
  if (type === "text") {
    const firstLine = value.split("\n").find((l) => l.trim().length > 0) ?? value;
    return firstLine.trim().slice(0, 80);
  }
  return value.slice(0, 120);
}

/** Create one import job for a single source item. */
export async function createSingleJob(
  ownerEmail: string,
  type: SourceType,
  value: string,
): Promise<ImportJobRow> {
  const db = await getDb();
  const [row] = await db
    .insert(importJob)
    .values({
      ownerEmail,
      sourceType: type,
      label: labelFor(type, value),
      rawInput: value,
      status: "pending",
    })
    .returning();
  return row;
}

/** Split a bulk blob into items and create one job per item. */
export async function createBulkJobs(
  ownerEmail: string,
  blob: string,
): Promise<{ batchId: string; jobs: ImportJobRow[] }> {
  const db = await getDb();
  const batchId = randomUUID();
  const items = await prepareBulkItems(blob);
  if (items.length === 0) {
    // Treat the whole blob as a single text recipe.
    items.push({ type: detectSourceType(blob), value: blob });
  }
  const jobs = await db
    .insert(importJob)
    .values(
      items.map((it) => ({
        ownerEmail,
        batchId,
        sourceType: it.type,
        label: labelFor(it.type, it.value),
        rawInput: it.value,
        status: "pending" as const,
      })),
    )
    .returning();
  return { batchId, jobs };
}

async function prepareBulkItems(blob: string): Promise<{ type: SourceType; value: string }[]> {
  let items = splitBulkInput(blob);
  const hasLinks = items.some((item) => item.type === "url" || item.type === "youtube");

  if (!hasLinks && blob.trim().length > 120) {
    try {
      const { segmentBulk } = await import("@/lib/ai/extract");
      const segments = await segmentBulk(blob);
      const segmented = segments
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .map((value) => ({ type: detectSourceType(value), value }));

      if (segmented.length > items.length) {
        items = segmented;
      }
    } catch (error) {
      console.warn("AI bulk segmentation failed; using simple splitter.", error);
    }
  }

  return dedupeItems(items).slice(0, MAX_BULK_ITEMS);
}

function dedupeItems(items: { type: SourceType; value: string }[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.type}:${item.value.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getJob(id: string): Promise<ImportJobRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(importJob).where(eq(importJob.id, id)).limit(1);
  return row ?? null;
}

export async function updateJob(
  id: string,
  patch: Partial<ImportJobRow>,
): Promise<ImportJobRow | null> {
  const db = await getDb();
  const [row] = await db
    .update(importJob)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(importJob.id, id))
    .returning();
  return row ?? null;
}

export async function getBatch(batchId: string): Promise<ImportJobRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(importJob)
    .where(eq(importJob.batchId, batchId))
    .orderBy(importJob.createdAt);
}

/** Recent jobs for the import history panel. */
export async function listRecentJobs(ownerEmail: string, limit = 20): Promise<ImportJobRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(importJob)
    .where(and(eq(importJob.ownerEmail, ownerEmail)))
    .orderBy(desc(importJob.createdAt))
    .limit(limit);
}

export async function clearImportHistory(ownerEmail: string): Promise<void> {
  const db = await getDb();
  await db.delete(importJob).where(eq(importJob.ownerEmail, ownerEmail));
}
