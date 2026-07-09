import "server-only";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** True when the URL responds with an actual image we could show. */
async function isWorkingImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "image/*,*/*;q=0.8", range: "bytes=0-2047" },
      redirect: "follow",
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return false;
    const type = res.headers.get("content-type") ?? "";
    // Read a little of the body so half-dead CDN endpoints don't slip through.
    await res.body?.cancel();
    return type.startsWith("image/");
  } catch {
    return false;
  }
}

/**
 * Pick the first image URL that actually loads. Imported pages often list a
 * hero image that 404s or is login-gated, while a lower-ranked candidate is
 * fine — checking at import time means saved recipes get a photo that works.
 */
export async function pickWorkingImage(
  candidates: Array<string | null | undefined>,
): Promise<string | null> {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const candidate of candidates) {
    const url = candidate?.trim();
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  for (const url of urls.slice(0, 6)) {
    if (await isWorkingImage(url)) return url;
  }
  return null;
}
