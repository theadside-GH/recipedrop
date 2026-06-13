CREATE TYPE "public"."import_status" AS ENUM('pending', 'processing', 'done', 'needs_review', 'failed');--> statement-breakpoint
CREATE TYPE "public"."meal_type" AS ENUM('breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'side', 'drink');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('url', 'text', 'photo', 'youtube');--> statement-breakpoint
CREATE TYPE "public"."unit_category" AS ENUM('mass', 'volume', 'count', 'pinch', 'unknown');--> statement-breakpoint
CREATE TABLE "canonical_ingredient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"default_unit_category" "unit_category" DEFAULT 'unknown' NOT NULL,
	"aisle" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_email" text NOT NULL,
	"batch_id" uuid,
	"source_type" "source_type" NOT NULL,
	"label" text,
	"raw_input" text NOT NULL,
	"status" "import_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"recipe_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_email" text NOT NULL,
	"name" text NOT NULL,
	"status" "plan_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_plan_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"planned_servings" integer DEFAULT 2 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_email" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source_type" "source_type" DEFAULT 'text' NOT NULL,
	"source_url" text,
	"source_author" text,
	"image_path" text,
	"prep_minutes" integer,
	"cook_minutes" integer,
	"total_minutes" integer,
	"servings_default" integer DEFAULT 2 NOT NULL,
	"meal_type" "meal_type" DEFAULT 'dinner' NOT NULL,
	"difficulty" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"raw_text" text NOT NULL,
	"canonical_ingredient_id" uuid,
	"canonical_name" text,
	"quantity" double precision,
	"unit" text,
	"unit_category" "unit_category" DEFAULT 'unknown' NOT NULL,
	"note" text,
	"optional" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_tag" (
	"recipe_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_plan_id" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopping_list_id" uuid NOT NULL,
	"canonical_name" text NOT NULL,
	"aisle" text,
	"display_text" text NOT NULL,
	"total_quantity" double precision,
	"base_unit" text,
	"unit_category" "unit_category" DEFAULT 'unknown' NOT NULL,
	"is_summable" boolean DEFAULT true NOT NULL,
	"is_checked" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"instruction" text NOT NULL,
	"duration_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_item" ADD CONSTRAINT "meal_plan_item_meal_plan_id_meal_plan_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_item" ADD CONSTRAINT "meal_plan_item_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_canonical_ingredient_id_canonical_ingredient_id_fk" FOREIGN KEY ("canonical_ingredient_id") REFERENCES "public"."canonical_ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tag" ADD CONSTRAINT "recipe_tag_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tag" ADD CONSTRAINT "recipe_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list" ADD CONSTRAINT "shopping_list_meal_plan_id_meal_plan_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_item" ADD CONSTRAINT "shopping_list_item_shopping_list_id_shopping_list_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."shopping_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step" ADD CONSTRAINT "step_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "canonical_ingredient_name_idx" ON "canonical_ingredient" USING btree ("name");--> statement-breakpoint
CREATE INDEX "import_job_owner_idx" ON "import_job" USING btree ("owner_email");--> statement-breakpoint
CREATE INDEX "import_job_batch_idx" ON "import_job" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "meal_plan_item_plan_idx" ON "meal_plan_item" USING btree ("meal_plan_id");--> statement-breakpoint
CREATE INDEX "recipe_owner_idx" ON "recipe" USING btree ("owner_email");--> statement-breakpoint
CREATE INDEX "recipe_meal_type_idx" ON "recipe" USING btree ("meal_type");--> statement-breakpoint
CREATE INDEX "recipe_total_minutes_idx" ON "recipe" USING btree ("total_minutes");--> statement-breakpoint
CREATE INDEX "recipe_ingredient_recipe_idx" ON "recipe_ingredient" USING btree ("recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_tag_pk" ON "recipe_tag" USING btree ("recipe_id","tag_id");--> statement-breakpoint
CREATE INDEX "shopping_list_item_list_idx" ON "shopping_list_item" USING btree ("shopping_list_id");--> statement-breakpoint
CREATE INDEX "step_recipe_idx" ON "step" USING btree ("recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_name_idx" ON "tag" USING btree ("name");