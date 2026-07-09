import Link from "next/link";
import { ArrowLeft, BookMarked, ChevronRight, Globe } from "lucide-react";
import { getOwnerEmail } from "@/lib/auth";
import { listCollections, type CollectionSummary } from "@/lib/repo/collections";
import { RecipeImage } from "@/components/recipe-image";
import { Badge } from "@/components/ui/badge";
import { CreateCollection } from "./create-collection";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const owner = await getOwnerEmail();
  const collections = await listCollections(owner);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/recipes"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Your Recipes
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Collections</h1>
        <p className="mt-1 text-muted">
          Group recipes into little cookbooks — and share a whole collection with one link.
        </p>
      </div>

      <CreateCollection />

      {collections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center text-muted">
          No collections yet. Create one above, then add recipes from any recipe page.
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map((c) => (
            <CollectionRow key={c.id} collection={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionRow({ collection: c }: { collection: CollectionSummary }) {
  return (
    <Link
      href={`/collections/${c.id}`}
      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-surface"
    >
      <CoverMosaic images={c.coverImages} name={c.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-semibold">{c.name}</p>
        <p className="mt-0.5 flex items-center gap-2 text-sm text-muted">
          {c.recipeCount} recipe{c.recipeCount === 1 ? "" : "s"}
          {c.isPublic && (
            <Badge variant="fresh">
              <Globe className="h-3 w-3" /> Public
            </Badge>
          )}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
    </Link>
  );
}

function CoverMosaic({ images, name }: { images: (string | null)[]; name: string }) {
  if (images.length === 0) {
    return (
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
        <BookMarked className="h-6 w-6" />
      </span>
    );
  }
  return (
    <span className="grid h-14 w-14 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-xl bg-surface">
      {images.slice(0, 4).map((src, i) => (
        <span key={i} className={images.length === 1 ? "col-span-2 row-span-2" : ""}>
          <RecipeImage src={src} title={name} mealType="dinner" imgClassName="rounded-none" />
        </span>
      ))}
    </span>
  );
}
