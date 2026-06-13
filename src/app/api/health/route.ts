import { NextResponse } from "next/server";
import { features } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    app: "RecipeDrop",
    mode: features.usePostgres ? "cloud" : "local",
    authEnabled: features.authEnabled,
    aiEnabled: features.aiEnabled,
  });
}
