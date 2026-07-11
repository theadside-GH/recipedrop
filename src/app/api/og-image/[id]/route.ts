import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { recipe } from "@/lib/db/schema";
import { isHostedImage } from "@/lib/storage";

/**
 * Serves a public recipe's photo at a stable URL so shared links can carry a
 * real og:image — chat apps and crawlers can't read the data: URLs the photos
 * are stored as. Only public, non-hidden recipes are served; everything else
 * 404s so this can never leak a private photo.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const db = await getDb();
  const [row] = await db
    .select({ imagePath: recipe.imagePath, isPublic: recipe.isPublic, isHidden: recipe.isHidden })
    .from(recipe)
    .where(eq(recipe.id, id))
    .limit(1);
  if (!row || !row.isPublic || row.isHidden || !row.imagePath) {
    return new Response("Not found", { status: 404 });
  }

  const cache = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";

  // Embedded snapshot (the common case): decode and serve the bytes.
  const dataMatch = row.imagePath.match(/^data:(image\/[\w.+-]+);base64,([\s\S]+)$/);
  if (dataMatch) {
    const bytes = Buffer.from(dataMatch[2], "base64");
    return new Response(new Uint8Array(bytes), {
      headers: { "content-type": dataMatch[1], "cache-control": cache },
    });
  }

  // Our own hosted photos redirect straight to the CDN; other remote URLs go
  // through the hardened image proxy (hotlink-protected source sites).
  if (isHostedImage(row.imagePath)) {
    return NextResponse.redirect(row.imagePath, { headers: { "cache-control": cache } });
  }
  if (/^https?:\/\//i.test(row.imagePath)) {
    const proxied = new URL(`/api/img?u=${encodeURIComponent(row.imagePath)}`, _request.url);
    return NextResponse.redirect(proxied, { headers: { "cache-control": cache } });
  }

  return new Response("Not found", { status: 404 });
}
