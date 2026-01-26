CREATE TABLE "user_monthly_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"month" text NOT NULL,
	"coins_uploaded_count" integer DEFAULT 0 NOT NULL,
	"trades_initiated_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_tier" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_monthly_stats" ADD CONSTRAINT "user_monthly_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_id_month" ON "user_monthly_stats" USING btree ("user_id","month");--> statement-breakpoint
CREATE INDEX "idx_user_id" ON "user_monthly_stats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_month" ON "user_monthly_stats" USING btree ("month");--> statement-breakpoint
CREATE INDEX "idx_user_subscription_tier" ON "users" USING btree ("subscription_tier");