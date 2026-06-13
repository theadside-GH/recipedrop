import { ChefHat } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE: Record<string, { bg: string; mark: string; line: string }> = {
  breakfast: { bg: "bg-[#fff7ed]", mark: "bg-[#f97316] text-white", line: "bg-[#fed7aa]" },
  lunch: { bg: "bg-[#f0fdf4]", mark: "bg-[#16a34a] text-white", line: "bg-[#bbf7d0]" },
  dinner: { bg: "bg-[#f8fafc]", mark: "bg-[#475569] text-white", line: "bg-[#cbd5e1]" },
  snack: { bg: "bg-[#fefce8]", mark: "bg-[#ca8a04] text-white", line: "bg-[#fde68a]" },
  dessert: { bg: "bg-[#fdf2f8]", mark: "bg-[#db2777] text-white", line: "bg-[#fbcfe8]" },
  side: { bg: "bg-[#ecfeff]", mark: "bg-[#0891b2] text-white", line: "bg-[#a5f3fc]" },
  drink: { bg: "bg-[#eff6ff]", mark: "bg-[#2563eb] text-white", line: "bg-[#bfdbfe]" },
};

export function RecipeImage({
  src,
  title,
  mealType,
  imgClassName,
  loading = "lazy",
}: {
  src: string | null;
  title: string;
  mealType: string;
  imgClassName?: string;
  loading?: "eager" | "lazy";
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={title}
        className={cn("h-full w-full object-cover", imgClassName)}
        loading={loading}
      />
    );
  }

  const tone = TONE[mealType] ?? TONE.dinner;
  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden",
        tone.bg,
      )}
      aria-label={title}
    >
      <div className="absolute inset-x-0 top-0 grid grid-cols-5 gap-1 p-3 opacity-80">
        <span className={cn("h-1 rounded-full", tone.line)} />
        <span className={cn("h-1 rounded-full", tone.line)} />
        <span className={cn("h-1 rounded-full", tone.line)} />
        <span className={cn("h-1 rounded-full", tone.line)} />
        <span className={cn("h-1 rounded-full", tone.line)} />
      </div>
      <span className={cn("flex h-14 w-14 items-center justify-center rounded-full", tone.mark)}>
        <ChefHat className="h-7 w-7" />
      </span>
      <div className="absolute bottom-3 left-3 right-3 h-2 rounded-full bg-white/70" />
    </div>
  );
}
