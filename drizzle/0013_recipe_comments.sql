CREATE TABLE "recipe_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"author_email" text NOT NULL,
	"body" text NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_comment" ADD CONSTRAINT "recipe_comment_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_comment_recipe_idx" ON "recipe_comment" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_comment_author_idx" ON "recipe_comment" USING btree ("author_email");