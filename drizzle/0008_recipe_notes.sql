CREATE TABLE "recipe_note" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "recipe_id" uuid NOT NULL REFERENCES "recipe"("id") ON DELETE CASCADE,
  "owner_email" text NOT NULL,
  "kind" text DEFAULT 'note' NOT NULL,
  "body" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "recipe_note_recipe_idx" ON "recipe_note" ("recipe_id");
--> statement-breakpoint
CREATE INDEX "recipe_note_owner_idx" ON "recipe_note" ("owner_email");
