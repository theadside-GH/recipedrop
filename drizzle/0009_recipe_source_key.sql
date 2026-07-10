ALTER TABLE "recipe" ADD COLUMN "source_key" text;
--> statement-breakpoint
CREATE INDEX "recipe_source_key_idx" ON "recipe" USING btree ("source_key");
