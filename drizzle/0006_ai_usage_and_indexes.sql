CREATE TABLE "ai_usage_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_email" text NOT NULL,
  "kind" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_usage_owner_time_idx" ON "ai_usage_event" ("owner_email", "created_at");
--> statement-breakpoint
CREATE INDEX "meal_plan_owner_idx" ON "meal_plan" ("owner_email");
