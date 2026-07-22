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
