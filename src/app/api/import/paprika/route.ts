import { NextRequest, NextResponse } from "next/server";
import { getOwnerEmail } from "@/lib/auth";
import { importPaprikaArchive } from "@/lib/import/paprika";

export const dynamic = "force-dynamic";
// A 500-recipe archive with photos takes a while to write row by row.
export const maxDuration = 300;

/**
 * Upload endpoint for Paprika exports. A route handler rather than a server
 * action: exports with embedded photos routinely blow past the server-action
 * body limit, while Functions accept large bodies fine.
 */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  // Route handlers accept cross-site POSTs; server actions get CSRF checks
  // for free but this isn't one, so verify the caller is our own page.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ error: "Cross-origin upload rejected." }, { status: 403 });
  }

  let owner: string;
  try {
    owner = await getOwnerEmail();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Please sign in to do that." },
      { status: 401 },
    );
  }

  const declaredBytes = Number(request.headers.get("content-length") ?? 0);
  if (declaredBytes > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "That export is over 50 MB. Export without photos in Paprika and try again." },
      { status: 413 },
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file received." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "That export is over 50 MB. Export without photos in Paprika and try again." },
        { status: 413 },
      );
    }
    const archive = new Uint8Array(await file.arrayBuffer());
    const result = await importPaprikaArchive(owner, archive);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed." },
      { status: 400 },
    );
  }
}
