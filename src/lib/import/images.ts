import "server-only";
import sharp from "sharp";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
// Match the client-side upload settings (see imageFileToDataUrl callers).
const MAX_EDGE = 900;
const JPEG_QUALITY = 76;
// Reject icons and flat "no photo" placeholder graphics. Real recipe photos
// measure entropy >= 6.4 in practice; site placeholders land near 1-3.
const MIN_EDGE = 180;
const MIN_ENTROPY = 5;

/**
 * True when the (already JPEG-encoded) buffer looks like an actual photo
 * rather than an icon or a recipe site's flat "no photo" placeholder.
 */
export async function photoLooksReal(jpeg: Buffer): Promise<boolean> {
  try {
    const img = sharp(jpeg);
    const meta = await img.metadata();
    if (Math.min(meta.width ?? 0, meta.height ?? 0) < MIN_EDGE) return false;
    const stats = await img.stats();
    return stats.entropy >= MIN_ENTROPY;
  } catch {
    return false;
  }
}

/**
 * Download an image and re-encode it as a self-contained JPEG data: URL.
 * Recipe photos are routinely hosted on signed social CDNs (TikTok/Instagram)
 * whose URLs expire within days — a stored remote URL rots even if it loads
 * at save time. Storing the resized bytes keeps the photo working forever.
 * Returns null (never throws) when the URL is dead, not an image, or too big.
 */
export async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "image/*,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_SOURCE_BYTES) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_SOURCE_BYTES) return null;
    const jpeg = await sharp(bytes)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    if (!(await photoLooksReal(jpeg))) return null;
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Snapshot the first candidate that is a real, loadable image, as a data: URL
 * ready to store in recipe.imagePath. Imported pages often list a hero image
 * that 404s or is login-gated while a lower-ranked candidate is fine, so each
 * candidate is fetched until one converts. data: candidates pass through
 * unchanged (already self-contained).
 */
export async function pickWorkingImage(
  candidates: Array<string | null | undefined>,
): Promise<string | null> {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const candidate of candidates) {
    const url = candidate?.trim();
    if (!url || seen.has(url)) continue;
    if (url.startsWith("data:image/")) return url;
    if (!/^https?:\/\//i.test(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  for (const url of urls.slice(0, 6)) {
    const snapshot = await imageUrlToDataUrl(url);
    if (snapshot) return snapshot;
  }
  return null;
}
