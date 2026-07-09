CREATE TABLE "pantry_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_email" text NOT NULL,
  "canonical_name" text NOT NULL,
  "aisle" text,
  "in_pantry" boolean DEFAULT true NOT NULL,
  "has_leftover" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pantry_item_owner_name_idx" ON "pantry_item" ("owner_email", "canonical_name");
--> statement-breakpoint
CREATE INDEX "pantry_item_owner_idx" ON "pantry_item" ("owner_email");
