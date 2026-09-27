export async function imageFileToDataUrl(
  file: File,
  opts: { maxSize?: number; quality?: number } = {},
): Promise<string> {
  const maxSize = opts.maxSize ?? 1200;
  const quality = opts.quality ?? 0.82;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

/** A JPEG ready for the photo-import action (base64, no data: prefix). */
export interface RecipeImagePart {
  mediaType: "image/jpeg";
  data: string;
}

// The photo reader accepts up to 2576px on the long edge; stay just under.
const READ_MAX_EDGE = 2400;
// Taller than this (height/width) is a scrolling screenshot: cut it into
// full-width tiles instead of shrinking it until the text is unreadable.
const TALL_RATIO = 2.2;
const TILE_OVERLAP = 160;
const MAX_TILES = 12;
// Vercel rejects request bodies over 4.5 MB; leave room for the envelope.
const UPLOAD_BUDGET_BYTES = 3_400_000;

/**
 * Turn recipe photos/screenshots into the images the photo reader sees best:
 * full resolution up to its limit, long screenshots tiled top to bottom with a
 * small overlap, all re-encoded as JPEG within one upload budget. Throws a
 * user-facing message for formats the browser can't decode (HEIC on desktop).
 */
export async function prepareRecipeImages(files: File[]): Promise<RecipeImagePart[]> {
  const bitmaps: ImageBitmap[] = [];
  try {
    for (const file of files) {
      try {
        bitmaps.push(await createImageBitmap(file));
      } catch {
        throw new Error(
          `Couldn't open "${file.name}" — this browser can't read that photo format (often HEIC). ` +
            "Take a screenshot of it, or export it as JPG, and upload that.",
        );
      }
    }
    // Shrink until the whole set fits the upload: first JPEG quality, then size.
    for (const [scale, quality] of [
      [1, 0.85],
      [1, 0.72],
      [0.8, 0.72],
      [0.65, 0.7],
      [0.5, 0.68],
    ] as const) {
      const parts = bitmaps.flatMap((bitmap) => renderParts(bitmap, scale, quality));
      if (parts.length > MAX_TILES) continue;
      const bytes = parts.reduce((sum, part) => sum + part.data.length, 0);
      if (bytes <= UPLOAD_BUDGET_BYTES) return parts;
    }
    throw new Error("Those photos are too large to send together — try fewer at a time.");
  } finally {
    for (const bitmap of bitmaps) bitmap.close();
  }
}

function renderParts(bitmap: ImageBitmap, scale: number, quality: number): RecipeImagePart[] {
  const tall = bitmap.height / bitmap.width > TALL_RATIO;
  // Tiles keep the screenshot's width; single images fit the long edge.
  const fit = tall
    ? Math.min(1, READ_MAX_EDGE / 1.6 / bitmap.width)
    : Math.min(1, READ_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const k = fit * scale;
  const width = Math.max(1, Math.round(bitmap.width * k));
  const height = Math.max(1, Math.round(bitmap.height * k));
  const tileHeight = tall ? Math.min(height, Math.round(READ_MAX_EDGE * scale)) : height;
  const parts: RecipeImagePart[] = [];
  for (let top = 0; top < height; top += tileHeight - TILE_OVERLAP) {
    const h = Math.min(tileHeight, height - top);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare image.");
    ctx.fillStyle = "#fff"; // transparent PNG screenshots would turn black as JPEG
    ctx.fillRect(0, 0, width, h);
    ctx.drawImage(bitmap, 0, top / k, bitmap.width, h / k, 0, 0, width, h);
    parts.push({
      mediaType: "image/jpeg",
      data: canvas.toDataURL("image/jpeg", quality).split(",")[1] ?? "",
    });
    if (top + h >= height) break;
  }
  return parts;
}
