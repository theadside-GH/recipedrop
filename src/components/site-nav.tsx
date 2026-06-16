"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChefHat, BookOpen, PlusCircle, ShoppingBasket, Compass, User } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Recipes", icon: BookOpen, match: (p: string) => p === "/" || p.startsWith("/recipes") },
  { href: "/discover", label: "Discover", icon: Compass, match: (p: string) => p.startsWith("/discover") },
  { href: "/import", label: "Import", icon: PlusCircle, match: (p: string) => p.startsWith("/import") },
  { href: "/plans", label: "Meal Plans", icon: ShoppingBasket, match: (p: string) => p.startsWith("/plans") },
  { href: "/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/profile") },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <>
      {/* Top bar (desktop + mobile header) */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <ChefHat className="h-5 w-5" />
            </span>
            <span>RecipeDrop</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {LINKS.map((l) => {
              const active = l.match(pathname);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    active ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface",
                  )}
                >
                  <l.icon className="h-4 w-4" />
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Bottom tab bar (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur sm:hidden">
        {LINKS.map((l) => {
          const active = l.match(pathname);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-xs",
                active ? "text-brand" : "text-muted",
              )}
            >
              <l.icon className="h-5 w-5" />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
