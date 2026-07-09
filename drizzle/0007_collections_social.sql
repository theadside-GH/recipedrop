CREATE TABLE "collection" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_email" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "is_public" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "collection_owner_idx" ON "collection" ("owner_email");
--> statement-breakpoint
CREATE INDEX "collection_public_idx" ON "collection" ("is_public");
--> statement-breakpoint
CREATE TABLE "collection_recipe" (
  "collection_id" uuid NOT NULL REFERENCES "collection"("id") ON DELETE CASCADE,
  "recipe_id" uuid NOT NULL REFERENCES "recipe"("id") ON DELETE CASCADE,
  "sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "collection_recipe_pk" ON "collection_recipe" ("collection_id", "recipe_id");
--> statement-breakpoint
CREATE TABLE "follow" (
  "follower_email" text NOT NULL,
  "followee_email" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "follow_pair_idx" ON "follow" ("follower_email", "followee_email");
--> statement-breakpoint
CREATE INDEX "follow_followee_idx" ON "follow" ("followee_email");
--> statement-breakpoint
CREATE TABLE "cooked_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "recipe_id" uuid NOT NULL REFERENCES "recipe"("id") ON DELETE CASCADE,
  "cooker_email" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cooked_event_pair_idx" ON "cooked_event" ("recipe_id", "cooker_email");
