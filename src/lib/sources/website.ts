import "server-only";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import type { SourceContent } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Social sites (Instagram/Facebook) only embed Open Graph caption tags when the
// request looks like a link-preview crawler, not a browser.
const CRAWLER_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

async function fetchHtml(url: string, ua = UA): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": ua, accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Could not fetch the page (HTTP ${res.status}).`);
  return res.text();
}

// Social video posts (Reels/TikToks) are login-walled, so Readability sees
// nothing — but the public caption + thumbnail live in Open Graph meta tags,
// and the caption is almost always the recipe.
const SOCIAL_HOSTS = ["instagram.com", "tiktok.com", "facebook.com", "fb.watch"];

function isSocialHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return SOCIAL_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

function meta(dom: JSDOM, prop: string): string | null {
  const doc = dom.window.document;
  const el =
    doc.querySelector(`meta[property="${prop}"]`) ??
    doc.querySelector(`meta[name="${prop}"]`);
  return el?.getAttribute("content")?.trim() || null;
}

/**
 * Strip the engagement prefix Instagram prepends to og:description, e.g.
 * `1,234 likes, 56 comments - chef.jane on June 1, 2024: "<caption>"` -> the
 * caption alone. TikTok/Facebook usually put the caption there directly.
 */
function cleanSocialCaption(raw: string): string {
  let s = raw.trim();
  // Both og:title ("<name> on Instagram: "<caption>"") and og:description
  // ("<n> likes ... on <date>: "<caption>". ") wrap the caption in quotes after
  // a "<prefix>: ". Strip the prefix up to the opening quote, then drop the
  // closing quote plus any trailing punctuation/space the platform tacks on.
  const open = s.match(/:\s*["“]/);
  if (open && open.index !== undefined) {
    s = s.slice(open.index + open[0].length).replace(/["”][\s.]*$/, "");
  }
  return s.trim();
}

/** Best-effort recipe pull from a social post via its Open Graph metadata. */
function fetchSocialCaption(dom: JSDOM, url: string): SourceContent {
  const host = new URL(url).hostname.replace(/^www\./, "").replace(/\.com$/, "");
  const platform = host.charAt(0).toUpperCase() + host.slice(1);
  const title = meta(dom, "og:title");
  const desc = meta(dom, "og:description");
  // og:title carries the FULL caption on Instagram; og:description is truncated
  // and prefixed with like/comment counts. Take whichever yields more recipe.
  const fromTitle = cleanSocialCaption(title ?? "");
  const fromDesc = cleanSocialCaption(desc ?? "");
  const caption = fromTitle.length >= fromDesc.length ? fromTitle : fromDesc;
  // The name sits before " on Instagram/TikTok/..." on the first line of og:title.
  const author =
    title?.match(/^(.+?)\s+on\s+(?:Instagram|TikTok|Facebook)\b/i)?.[1]?.trim() || null;

  if (caption.length < 40) {
    throw new Error(
      `${platform} hid this post's caption from us (it may be private or login-gated). ` +
        `Open the post, copy the caption text, and paste it into the "Paste text" tab instead.`,
    );
  }
  return {
    text: `Recipe from a ${platform} post${author ? ` by ${author}` : ""}:\n\n${caption}`,
    imageUrl: meta(dom, "og:image"),
    author,
    context: url,
  };
}

/** Collect every JSON-LD block, flattening @graph arrays. */
function collectJsonLd(dom: JSDOM): unknown[] {
  const nodes = [
    ...dom.window.document.querySelectorAll('script[type="application/ld+json"]'),
  ];
  const out: unknown[] = [];
  for (const node of nodes) {
    const raw = node.textContent?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of arr) {
        const e = entry as Record<string, unknown>;
        if (Array.isArray(e["@graph"])) out.push(...(e["@graph"] as unknown[]));
        else out.push(entry);
      }
    } catch {
      // Real-world JSON-LD is often malformed; skip unparseable blocks.
    }
  }
  return out;
}

function isRecipeNode(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== "object") return false;
  const t = (node as Record<string, unknown>)["@type"];
  if (typeof t === "string") return t.toLowerCase() === "recipe";
  if (Array.isArray(t)) return t.some((x) => String(x).toLowerCase() === "recipe");
  return false;
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join("\n");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return asText(o.text ?? o.name ?? o.itemListElement ?? "");
  }
  return String(v);
}

function firstImage(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return firstImage(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return firstImage(o.url ?? o.contentUrl ?? null);
  }
  return null;
}

/**
 * Build a compact text block from a schema.org Recipe node so the model gets
 * structured ingredients/steps instead of raw page chrome.
 */
function recipeNodeToText(node: Record<string, unknown>): SourceContent {
  const lines: string[] = [];
  if (node.name) lines.push(`Title: ${asText(node.name)}`);
  if (node.recipeYield) lines.push(`Yield: ${asText(node.recipeYield)}`);
  if (node.prepTime) lines.push(`Prep time: ${asText(node.prepTime)}`);
  if (node.cookTime) lines.push(`Cook time: ${asText(node.cookTime)}`);
  if (node.totalTime) lines.push(`Total time: ${asText(node.totalTime)}`);
  if (node.recipeCategory) lines.push(`Category: ${asText(node.recipeCategory)}`);
  if (node.description) lines.push(`Description: ${asText(node.description)}`);
  lines.push("\nIngredients:");
  const ing = node.recipeIngredient ?? node.ingredients;
  for (const i of Array.isArray(ing) ? ing : [ing]) {
    const s = asText(i);
    if (s) lines.push(`- ${s}`);
  }
  lines.push("\nInstructions:");
  const instr = node.recipeInstructions;
  const steps = Array.isArray(instr) ? instr : [instr];
  let n = 1;
  for (const st of steps) {
    const s = asText(st);
    if (s) lines.push(`${n++}. ${s}`);
  }
  const author =
    typeof node.author === "object"
      ? asText((node.author as Record<string, unknown>)?.name)
      : asText(node.author);
  return {
    text: lines.join("\n"),
    imageUrl: firstImage(node.image),
    author: author || null,
  };
}

/**
 * Fetch a recipe web page and return clean text for extraction. Tries
 * schema.org JSON-LD first (most recipe sites embed it); falls back to
 * Readability main-content extraction.
 */
export async function fetchWebsite(url: string): Promise<SourceContent> {
  const social = isSocialHost(url);
  const html = await fetchHtml(url, social ? CRAWLER_UA : UA);
  const dom = new JSDOM(html, { url });

  if (social) return fetchSocialCaption(dom, url);

  const recipeNode = collectJsonLd(dom).find(isRecipeNode);
  if (recipeNode) {
    const content = recipeNodeToText(recipeNode);
    return { ...content, context: url };
  }

  // Fallback: Readability strips nav/ads/comments down to the article body.
  const ogImage = dom.window.document
    .querySelector('meta[property="og:image"]')
    ?.getAttribute("content");
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const text = article?.textContent?.trim();
  if (!text) {
    throw new Error(
      "Couldn't read a recipe from that page. Try pasting the recipe text instead.",
    );
  }
  return {
    text: `${article?.title ? `Title: ${article.title}\n\n` : ""}${text}`.slice(0, 16000),
    imageUrl: ogImage ?? null,
    author: article?.byline ?? null,
    context: url,
  };
}
