"use client";

import { useEffect, useRef } from "react";
import { MoreHorizontal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "⋯ More" dropdown for secondary actions, so primary rows stay short. Same
 * <details> pattern as CollectionPicker: no state library, closes on outside
 * click and Escape, and any item click closes it (items run their own
 * handlers).
 */
export function OverflowMenu({
  label = "More",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = () => {
      if (detailsRef.current?.open) detailsRef.current.open = false;
    };
    const onPointer = (e: PointerEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={detailsRef} className="relative print:hidden">
      <summary
        className={cn(
          buttonVariants({ variant: "secondary", size: "lg" }),
          "cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden",
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
        {label}
      </summary>
      <div
        className="absolute right-0 top-full z-20 mt-2 w-56 rounded-2xl border border-border bg-card p-1.5 shadow-card-hover"
        onClick={() => {
          if (detailsRef.current) detailsRef.current.open = false;
        }}
      >
        {children}
      </div>
    </details>
  );
}

/** One row inside an OverflowMenu. */
export function OverflowMenuItem({
  icon: Icon,
  onClick,
  href,
  danger = false,
  disabled = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  /** Renders as a link (external when http[s]) instead of a button. */
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
    danger ? "text-red-600 hover:bg-red-50" : "hover:bg-surface",
    disabled && "pointer-events-none opacity-50",
  );
  if (href) {
    const external = /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className={className}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      <Icon className="h-4 w-4 shrink-0" />
      {children}
    </button>
  );
}
