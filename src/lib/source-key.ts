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
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  const path = url.pathname.replace(/\/+$/, "");
  const query = url.searchParams.toString();
  return `${host}${path}${query ? `?${query}` : ""}`;
}
