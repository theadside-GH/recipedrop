import "server-only";
import { randomUUID } from "node:crypto";
import { env, features } from "@/lib/env";

/**
 * Recipe photo hosting on Supabase Storage. Photos used to be stored as
 * data: URLs inside the database and inlined into every page — megabytes of
 * HTML per grid. Uploading them to the public `recipe-images` bucket turns
 * each photo into a small, CDN-cached URL instead.
 *
 * Every helper degrades gracefully: with no service key configured (or on
 * any upload failure) callers keep the embedded data: URL, so a photo is
 * never lost — just heavier.
 */

const BUCKET = "recipe-images";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function publicImageUrl(name: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/${BUCKET}/${name}`;
}

/** True when this imagePath already lives in our storage bucket. */
export function isHostedImage(value: string | null | undefined): boolean {
  return !!value && !!env.supabaseUrl && value.startsWith(`${env.supabaseUrl}/storage/`);
}

/** Upload image bytes; returns the public CDN URL, or null on any failure. */
export async function uploadImageBytes(
  bytes: Uint8Array,
  contentType = "image/jpeg",
): Promise<string | null> {
  if (!features.storageEnabled || bytes.byteLength === 0) return null;
  const name = `${randomUUID()}.${EXT[contentType] ?? "jpg"}`;
  try {
    const res = await fetch(`${env.supabaseUrl}/storage/v1/object/${BUCKET}/${name}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        "content-type": contentType,
        // Bucket files are immutable (unique names) — cache forever.
        "cache-control": "max-age=31536000, immutable",
      },
      body: bytes as BodyInit,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`Image upload failed (HTTP ${res.status}) — keeping embedded copy.`);
      return null;
    }
    return publicImageUrl(name);
  } catch (err) {
    console.warn("Image upload failed — keeping embedded copy.", err);
    return null;
  }
}

/**
 * Persist an image reference: data: URLs are uploaded and become hosted URLs;
 * http(s) URLs and null pass through unchanged. Falls back to the input on
 * any failure, so callers can use the result unconditionally.
 */
export async function persistImage(image: string | null): Promise<string | null> {
  if (!image || !features.storageEnabled) return image;
  const match = image.match(/^data:(image\/[\w.+-]+);base64,([\s\S]+)$/);
  if (!match) return image;
  const uploaded = await uploadImageBytes(Buffer.from(match[2], "base64"), match[1]);
  return uploaded ?? image;
}
