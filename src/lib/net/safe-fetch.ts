import "server-only";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { lookup as dnsLookupCb } from "node:dns";
import { Agent } from "undici";
import type { LookupFunction } from "node:net";

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
    // IPv4-mapped IPv6, dotted form (::ffff:a.b.c.d) — check embedded IPv4.
    const dotted = h.match(/:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted && /(^|:)::?ffff:/.test(h)) return isPrivateIp(dotted[1]);
    // IPv4-mapped IPv6, hex form (…:ffff:c0a8:0101) — reassemble the IPv4.
    const hex = h.match(/:ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      return isPrivateIp(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
    }
    // Loopback, unspecified, link-local, unique-local.
    return h === "::1" || h === "::" || h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd");
  }
  return /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}

/**
 * A `dns.lookup` drop-in that rejects any hostname resolving to a private
 * address — and, crucially, connects to *exactly* the address it validated.
 * Passing this to undici's connector removes the second, unvalidated DNS
 * resolution that plain `fetch` would otherwise do, closing the DNS-rebinding
 * TOCTOU where the guard sees a public IP but the socket lands on an internal
 * one.
 */
const pinnedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookupCb(hostname, { ...options, all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = Array.isArray(addresses) ? addresses : [addresses];
    for (const a of list) {
      if (isPrivateIp(a.address)) {
        return callback(
          new Error("That address points somewhere this app will not fetch from."),
          "",
          0,
        );
      }
    }
    // undici passes { all: true }; return the vetted list so it connects to
    // exactly what we validated (no second, unchecked resolution).
    return callback(null, list as never, 0);
  });
};

// Reused across calls so connections pool; the validating lookup applies to
// every socket it opens.
const safeAgent = new Agent({ connect: { lookup: pinnedLookup } });

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
 * Read a response body into a Buffer, aborting once `maxBytes` is exceeded.
 * Trusting `content-length` and then buffering the whole body lets a server
 * that omits the header stream unbounded data into memory (OOM); streaming
 * with a running cap closes that. Returns null when the body is too large.
 */
export async function readBodyCapped(res: Response, maxBytes: number): Promise<Buffer | null> {
  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > maxBytes ? null : buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks);
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
    // `dispatcher` is an undici extension to RequestInit (not in the DOM types).
    const response = await fetch(target, {
      ...init,
      redirect: "manual",
      dispatcher: safeAgent,
    } as RequestInit & { dispatcher: Agent });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The site sent a redirect with no destination.");
      target = new URL(location, target);
      continue;
    }
    return response;
  }
}
