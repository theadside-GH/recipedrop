import Link from "next/link";
import { ChefHat, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
        <ChefHat className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-2xl font-bold">This page isn&apos;t on the menu</h1>
      <p className="mt-2 text-muted">
        The recipe may have been deleted, made private, or the link has a typo.
      </p>
      <div className="mt-6">
        <Link href="/discover">
          <Button>
            <Compass className="h-4 w-4" /> Back to Discover
          </Button>
        </Link>
      </div>
    </div>
  );
}
