"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  BookOpen,
  Info,
  LogIn,
  PlusCircle,
  ShoppingBasket,
  Compass,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
  mobileLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
}

const LINKS: NavLink[] = [
  { href: "/discover", label: "Dishcover", icon: Compass, match: (p: string) => p.startsWith("/discover") },
  {
    href: "/recipes",
    label: "Your Recipes",
    mobileLabel: "Recipes",
    icon: BookOpen,
    match: (p: string) => p.startsWith("/recipes"),
  },
  { href: "/import", label: "Import", icon: PlusCircle, match: (p: string) => p.startsWith("/import") },
  {
    href: "/plans",
    label: "Shopping",
    mobileLabel: "Shop",
    icon: ShoppingBasket,
    match: (p: string) => p.startsWith("/plans"),
  },
  { href: "/pantry", label: "Pantry", icon: Archive, match: (p: string) => p.startsWith("/pantry") },
  { href: "/profile", label: "Profile", mobileLabel: "Me", icon: User, match: (p: string) => p.startsWith("/profile") },
];

// Signed-out visitors only get pages that work for them, plus a Sign in
// affordance — the full nav used to bounce every tap to /login unexplained.
const ANON_LINKS: NavLink[] = [
  { href: "/discover", label: "Dishcover", icon: Compass, match: (p: string) => p.startsWith("/discover") },
  { href: "/about", label: "About", icon: Info, match: (p: string) => p.startsWith("/about") },
];

export function SiteNav({ signedIn = true }: { signedIn?: boolean }) {
  const pathname = usePathname();
  const links = signedIn ? LINKS : ANON_LINKS;
  const loginHref = pathname.startsWith("/login")
    ? "/login"
    : `/login?next=${encodeURIComponent(pathname)}`;

  return (
    <>
      {/* Top bar (desktop + mobile header) */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/discover" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" className="h-9 w-9 rounded-full border border-border bg-white object-cover shadow-sm" />
            <span className="font-display text-xl font-semibold tracking-tight">DishCovered</span>
          </Link>
          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 sm:flex">
              {links.map((l) => {
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
            {!signedIn && (
              <Link
                href={loginHref}
                className="flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition-colors hover:bg-brand/90"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Bottom tab bar (mobile) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 grid border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        style={{ gridTemplateColumns: `repeat(${links.length + (signedIn ? 0 : 1)}, 1fr)` }}
      >
        {links.map((l) => {
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
              {l.mobileLabel ?? l.label}
            </Link>
          );
        })}
        {!signedIn && (
          <Link
            href={loginHref}
            className="flex flex-col items-center gap-1 py-2.5 text-xs font-semibold text-brand"
          >
            <LogIn className="h-5 w-5" />
            Sign in
          </Link>
        )}
      </nav>
    </>
  );
}
