"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Heart, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MEALS = ["breakfast", "lunch", "dinner", "snack", "dessert", "side", "drink"];
const TIMES = [
  { label: "<= 15 min", value: "15" },
  { label: "<= 30 min", value: "30" },
  { label: "<= 60 min", value: "60" },
];
const SORTS = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Favorites", value: "favorites" },
  { label: "Quickest", value: "quickest" },
  { label: "Title", value: "title" },
];

export function LibraryFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const meal = params.get("meal") ?? "";
  const max = params.get("max") ?? "";
  const search = params.get("q") ?? "";
  const favorite = params.get("favorite") === "1";
  const sort = params.get("sort") ?? "newest";

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && next.get(key) !== value) next.set(key, value);
    else next.delete(key);
    if (key === "sort" && value === "newest") next.delete("sort");
    router.push(`/?${next.toString()}`);
  }

  const hasFilters = meal || max || search || favorite || sort !== "newest";

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          defaultValue={search}
          placeholder="Search recipes..."
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
          }}
          onBlur={(e) => setParam("q", e.target.value)}
          className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm focus:border-brand focus-visible:outline-none"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <Chip active={!meal} onClick={() => setParam("meal", "")}>
          All meals
        </Chip>
        <Chip active={favorite} onClick={() => setParam("favorite", favorite ? "" : "1")}>
          <Heart className={cn("h-3.5 w-3.5", favorite && "fill-current")} />
          Favorites
        </Chip>
        {MEALS.map((m) => (
          <Chip key={m} active={meal === m} onClick={() => setParam("meal", m)} className="capitalize">
            {m}
          </Chip>
        ))}
        <span className="mx-1 w-px shrink-0 bg-border" />
        {TIMES.map((t) => (
          <Chip key={t.value} active={max === t.value} onClick={() => setParam("max", t.value)}>
            {t.label}
          </Chip>
        ))}
        <span className="mx-1 w-px shrink-0 bg-border" />
        {SORTS.map((s) => (
          <Chip key={s.value} active={sort === s.value} onClick={() => setParam("sort", s.value)}>
            {s.label}
          </Chip>
        ))}
        {hasFilters && (
          <Chip onClick={() => router.push("/")} className="text-muted">
            <X className="h-3.5 w-3.5" /> Clear
          </Chip>
        )}
      </div>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
  className,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-brand bg-brand text-brand-foreground"
          : "border-border bg-card text-foreground hover:bg-surface",
        className,
      )}
    >
      {children}
    </button>
  );
}
