import { redirect } from "next/navigation";
import { env } from "@/lib/env";

/**
 * Stable, printable URL for the iOS Shortcut: dishcovered.app/shortcut.
 * Redirects to the current iCloud link (swappable via IOS_SHORTCUT_URL
 * without touching any page that mentions it); falls back to the iPhone
 * setup guide until the link exists.
 */
export function GET() {
  redirect(env.iosShortcutUrl || "/ios");
}
