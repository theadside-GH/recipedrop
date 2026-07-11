import "server-only";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/**
 * SSRF-safe fetching for user-supplied URLs. Anything the app fetches on a
 * user's behalf (imported recipe pages, their images, the image proxy) goes
 * through here so a crafted link can never reach localhost, the cloud
 * metadata service, or anything else on the internal network.
 */

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
export async function isBlockedTarget(url: URL): Promise<boolean> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
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
 * fetch() for untrusted URLs: validates the target (and every redirect hop)
 * against internal hosts before connecting. Throws on blocked targets and on
 * redirect loops; otherwise returns the final response like a normal
 * `redirect: "follow"` fetch.
 */
export async function safeFetch(rawUrl: string | URL, init: RequestInit = {}): Promise<Response> {
  let target = new URL(rawUrl);
  for (let hop = 0; ; hop++) {
    if (hop > MAX_REDIRECTS) throw new Error("Too many redirects.");
    if (await isBlockedTarget(target)) {
      throw new Error("That address points somewhere this app will not fetch from.");
    }
    const response = await fetch(target, { ...init, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The site sent a redirect with no destination.");
      target = new URL(location, target);
      continue;
    }
    return response;
  }
}
