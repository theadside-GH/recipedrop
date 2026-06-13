"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPlanAction } from "@/app/actions";

export function CreatePlan() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function create() {
    const planName = name.trim() || "This week";
    startTransition(async () => {
      const { id } = await createPlanAction(planName);
      router.push(`/plans/${id}`);
    });
  }

  return (
    <div className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && create()}
        placeholder="Name your plan (e.g. “This week”)"
      />
      <Button onClick={create} disabled={isPending}>
        <Plus className="h-4 w-4" /> New plan
      </Button>
    </div>
  );
}
