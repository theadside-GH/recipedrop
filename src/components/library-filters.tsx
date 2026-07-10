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
const ORIGINS = [
  { label: "All recipes", value: "" },
  { label: "Dropped by you", value: "own" },
  { label: "Saved from cooks", value: "saved" },
];

export function LibraryFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const meal = params.get("meal") ?? "";
  const max = params.get("max") ?? "";
  const search = params.get("q") ?? "";
  const favorite = params.get("favorite") === "1";
  const origin = params.get("origin") ?? "";
  const sort = params.get("sort") ?? "newest";

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && next.get(key) !== value) next.set(key, value);
    else next.delete(key);
    if (key === "sort" && value === "newest") next.delete("sort");
    const query = next.toString();
    router.push(query ? `/recipes?${query}` : "/recipes");
  }

  const hasFilters = meal || max || search || favorite || origin || sort !== "newest";

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

      <div className="flex flex-wrap items-center gap-2">
        <Chip active={!meal} onClick={() => setParam("meal", "")}>
          All meals
        </Chip>
        <Chip active={favorite} onClick={() => setParam("favorite", favorite ? "" : "1")}>
          <Heart className={cn("h-3.5 w-3.5", favorite && "fill-current")} />
          Favorites
        </Chip>
        <FilterSelect
          label="Type"
          value={meal}
          onChange={(value) => setParam("meal", value)}
          options={[
            { label: "Any type", value: "" },
            ...MEALS.map((value) => ({ label: capitalize(value), value })),
          ]}
        />
        <FilterSelect
          label="Time"
          value={max}
          onChange={(value) => setParam("max", value)}
          options={[{ label: "Any time", value: "" }, ...TIMES]}
        />
        <FilterSelect
          label="Source"
          value={origin}
          onChange={(value) => setParam("origin", value)}
          options={ORIGINS}
        />
        <FilterSelect
          label="Sort"
          value={sort}
          onChange={(value) => setParam("sort", value)}
          options={SORTS}
        />
        {hasFilters && (
          <Chip onClick={() => router.push("/recipes")} className="text-muted">
            <X className="h-3.5 w-3.5" /> Clear
          </Chip>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <label className="flex min-w-32 flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground sm:flex-none">
      <span className="text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent font-medium capitalize focus-visible:outline-none"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
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
