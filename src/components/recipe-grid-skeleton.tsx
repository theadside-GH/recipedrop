export function RecipeGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="aspect-[4/3] w-full bg-surface" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-4/5 rounded-full bg-surface" />
            <div className="h-3 w-3/5 rounded-full bg-surface" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-8 w-56 rounded-full bg-surface" />
      <div className="h-4 w-72 rounded-full bg-surface" />
    </div>
  );
}
