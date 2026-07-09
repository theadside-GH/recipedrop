"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCollectionAction } from "@/app/actions";

export function CreateCollection() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function create() {
    const collectionName = name.trim() || "New collection";
    startTransition(async () => {
      const { id } = await createCollectionAction(collectionName);
      router.push(`/collections/${id}`);
    });
  }

  return (
    <div className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && create()}
        placeholder="Name your collection (e.g. “Weeknight pasta”)"
      />
      <Button onClick={create} disabled={isPending}>
        <Plus className="h-4 w-4" /> New collection
      </Button>
    </div>
  );
}
