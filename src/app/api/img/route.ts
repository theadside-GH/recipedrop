import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 4;

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const h = ip.toLowerCase();
    // IPv4-mapped IPv6 (::ffff:a.b.c.d) — check the embedded IPv4.
    const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    // Loopback, unspecified, link-local, unique-local.
    return h === "::1" || h === "::" || h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd");
  }
  return /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}

/**
 * Refuse hosts that point at internal services — checked per redirect hop, and
 * against every resolved DNS address so a public hostname can't smuggle in a
 * private IP.
 */
async function isBlockedTarget(url: URL): Promise<boolean> {
  const h = url.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (isIP(h)) return isPrivateIp(h);
  try {
    const addresses = await lookup(h, { all: true });
    return addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address));
  } catch {
    return true; // Unresolvable → don't fetch.
  }
}

/**
 * Image proxy for recipe photos saved as remote URLs. Many recipe sites and
 * social CDNs block hotlinking (referer/CORP checks), so the browser can't
 * load the image directly — fetching it server-side with a plain browser UA
 * and no referer succeeds. Responses are cached hard at the CDN/browser.
 */
export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("u");
  if (!raw) return new Response("Missing u", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("Bad url", { status: 400 });
  }

  // Follow redirects manually so every hop is validated, not just the first.
  let upstream: Response;
  for (let hop = 0; ; hop++) {
    if (hop > MAX_REDIRECTS) return new Response("Too many redirects", { status: 502 });
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return new Response("Bad protocol", { status: 400 });
    }
    if (await isBlockedTarget(target)) {
      return new Response("Blocked host", { status: 400 });
    }
    try {
      upstream = await fetch(target, {
        headers: { "user-agent": UA, accept: "image/*,*/*;q=0.8" },
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return new Response("Upstream fetch failed", { status: 502 });
    }
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (!location) return new Response("Bad redirect", { status: 502 });
      try {
        target = new URL(location, target);
      } catch {
        return new Response("Bad redirect", { status: 502 });
      }
      continue;
    }
    break;
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !contentType.startsWith("image/")) {
    return new Response("Not an image", { status: 502 });
  }
  const declaredLength = Number(upstream.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BYTES) {
    return new Response("Image too large", { status: 502 });
  }

  const buffer = await upstream.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    return new Response("Image too large", { status: 502 });
  }

  return new Response(buffer, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
    },
  });
}
