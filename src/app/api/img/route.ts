import { readBodyCapped, safeFetch } from "@/lib/net/safe-fetch";
import { isSafeRasterType, normalizeImageType } from "@/lib/net/image-content";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Image proxy for recipe photos saved as remote URLs. Many recipe sites and
 * social CDNs block hotlinking (referer/CORP checks), so the browser can't
 * load the image directly — fetching it server-side with a plain browser UA
 * and no referer succeeds. Responses are cached hard at the CDN/browser.
 *
 * SSRF is blocked by safeFetch (per-hop host validation), and other sites
 * can't use this as a free image proxy: requests carrying a foreign referer
 * are refused. No-referer requests (direct opens, link-preview crawlers) pass.
 */
export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).origin !== requestUrl.origin) {
        return new Response("Hotlinking not allowed", { status: 403 });
      }
    } catch {
      return new Response("Hotlinking not allowed", { status: 403 });
    }
  }

  const raw = requestUrl.searchParams.get("u");
  if (!raw) return new Response("Missing u", { status: 400 });

  let upstream: Response;
  try {
    upstream = await safeFetch(raw, {
      headers: { "user-agent": UA, accept: "image/*,*/*;q=0.8" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return new Response("Blocked or unreachable", { status: 400 });
  }

  // Raster types only — never reflect SVG (script-capable) from our origin.
  if (!upstream.ok || !isSafeRasterType(upstream.headers.get("content-type"))) {
    return new Response("Not an image", { status: 502 });
  }
  const declaredLength = Number(upstream.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BYTES) {
    return new Response("Image too large", { status: 502 });
  }

  const buffer = await readBodyCapped(upstream, MAX_BYTES);
  if (!buffer) return new Response("Image too large", { status: 502 });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": normalizeImageType(upstream.headers.get("content-type")),
      "content-length": String(buffer.byteLength),
      "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
      // Belt-and-suspenders: forbid MIME sniffing even for the raster types.
      "x-content-type-options": "nosniff",
    },
  });
}
