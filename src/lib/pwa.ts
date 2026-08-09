"use client";

/**
 * Forget every cached page. Called on sign-out so a signed-out user's private
 * pages (recipes, shopping lists) aren't readable offline by the next person
 * on a shared device. Belt and braces: message the service worker AND delete
 * the caches directly — the direct path works even when no worker controls
 * this tab yet.
 */
export async function clearCachedPages(): Promise<void> {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "clear-page-cache" });
  } catch {
    // No worker — the direct deletion below still runs.
  }
  try {
    if (!("caches" in window)) return;
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith("dishcovered-pages"))
        .map((name) => caches.delete(name)),
    );
  } catch {
    // Cache API unavailable (private browsing edge cases) — nothing cached.
  }
}
