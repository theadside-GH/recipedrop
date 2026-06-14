ALTER TABLE "recipe" ADD COLUMN "is_favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "recipe_favorite_idx" ON "recipe" USING btree ("is_favorite");--> statement-breakpoint
