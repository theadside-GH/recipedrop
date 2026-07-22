import { WifiOff } from "lucide-react";

// Static shell the service worker precaches and shows when a page is requested
// with no network and no cached copy. Kept dependency-free so it always renders.
export const dynamic = "force-static";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
        <WifiOff className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-2xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 text-muted">
        No connection right now. Recipes and shopping lists you&apos;ve already opened stay
        available — reopen them from the tabs below. New imports need to be back online.
      </p>
    </div>
  );
}
