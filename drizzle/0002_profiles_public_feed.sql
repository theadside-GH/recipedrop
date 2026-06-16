CREATE TABLE "user_profile" (
	"email" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"handle" text,
	"bio" text,
	"public_feed_opt_in" boolean DEFAULT false NOT NULL,
	"paid_tier" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_profile_handle_idx" ON "user_profile" USING btree ("handle");
--> statement-breakpoint
ALTER TABLE "recipe" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "recipe" ADD COLUMN "drop_count" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE INDEX "recipe_public_idx" ON "recipe" USING btree ("is_public");
--> statement-breakpoint
CREATE INDEX "recipe_drop_count_idx" ON "recipe" USING btree ("drop_count");
