/**
 * Canonical grouping key for a recipe's source link, so the same recipe
 * dropped by different people collapses to one listing. Share links to the
 * same page rarely match byte-for-byte — TikTok/Instagram/YouTube share URLs
 * carry per-share tracking params — so the key strips everything that varies
 * per share while keeping params that identify the content (e.g. youtube's
 * ?v=). Returns null when the value isn't an http(s) URL.
 */

/** Query params that identify the sharer or campaign, never the content. */
const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|igsh$|igshid$|si$|_t$|_r$|_d$|ref$|ref_src$|feature$|share_id$|is_from_webapp$|sender_device$)/;

export function sourceKeyFor(sourceUrl: string | null | undefined): string | null {
  const raw = sourceUrl?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  // youtu.be/ID is the share form of youtube.com/watch?v=ID — same video.
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (id) return `youtube.com/watch?v=${id}`;
  }
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  let path = url.pathname.replace(/\/+$/, "");
  // Instagram serves the same post under /reel/ and /reels/.
  if (host === "instagram.com") path = path.replace(/^\/reels\//, "/reel/");
  const query = url.searchParams.toString();
  return `${host}${path}${query ? `?${query}` : ""}`;
}

/**
 * Hosts whose links are per-share redirect stubs, not content URLs — two
 * people sharing the same video get different short codes, so keys computed
 * from them never group. These need resolveSourceKey (network) instead.
 */
export function isShortShareLink(sourceUrl: string | null | undefined): boolean {
  const raw = sourceUrl?.trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "vm.tiktok.com" || host === "vt.tiktok.com") return true;
    return host === "tiktok.com" && url.pathname.startsWith("/t/");
  } catch {
    return false;
  }
}
