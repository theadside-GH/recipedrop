/**
 * Raster image types we are willing to serve from our own origin. SVG is
 * deliberately excluded: it can carry <script>, so serving it inline (from any
 * origin the app controls) is a stored/reflected XSS vector. Everything the app
 * actually produces or imports is a raster photo, so this loses nothing.
 */
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

/** The bare MIME type (no charset/params), lowercased. */
export function normalizeImageType(contentType: string | null | undefined): string {
  return (contentType ?? "").split(";")[0].trim().toLowerCase();
}

/** True only for raster image types safe to serve inline from our origin. */
export function isSafeRasterType(contentType: string | null | undefined): boolean {
  return ALLOWED_IMAGE_TYPES.has(normalizeImageType(contentType));
}

/**
 * Sanitize a client-supplied image reference before storing it. Stored values
 * are later served inline from our origin (og-image, image proxy, /api/avatar),
 * so a `data:image/svg+xml` value (script-capable) would be a stored-XSS
 * vector. Accept only http(s) URLs and raster data: URLs; anything else
 * becomes null. Shared by recipe images and profile avatars — every stored
 * image must pass through here.
 */
export function sanitizeStoredImagePath(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const dataType = trimmed.match(/^data:([\w.+-]+\/[\w.+-]+);base64,/i)?.[1];
  if (dataType && isSafeRasterType(dataType)) return trimmed;
  return null;
}
