CREATE TABLE "coin_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coin_id" uuid NOT NULL,
	"url" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"country" text NOT NULL,
	"year" integer NOT NULL,
	"unit" text,
	"organization" text,
	"agency" text,
	"deployment" text,
	"coin_number" text,
	"mint_mark" text,
	"condition" text,
	"description" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"trade_status" text DEFAULT 'not_for_trade' NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"coin_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"coin_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"bio" text,
	"location" text,
	"collection_privacy" text DEFAULT 'public' NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"invite_code_used" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "coin_images" ADD CONSTRAINT "coin_images_coin_id_coins_id_fk" FOREIGN KEY ("coin_id") REFERENCES "public"."coins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coins" ADD CONSTRAINT "coins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_coin_id_coins_id_fk" FOREIGN KEY ("coin_id") REFERENCES "public"."coins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_coin_id_coins_id_fk" FOREIGN KEY ("coin_id") REFERENCES "public"."coins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_coin_images_coin" ON "coin_images" USING btree ("coin_id");--> statement-breakpoint
CREATE INDEX "idx_coin_user" ON "coins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_coin_visibility" ON "coins" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "idx_coin_country" ON "coins" USING btree ("country");--> statement-breakpoint
CREATE INDEX "idx_coin_year" ON "coins" USING btree ("year");--> statement-breakpoint
CREATE INDEX "idx_coin_trade_status" ON "coins" USING btree ("trade_status");--> statement-breakpoint
CREATE INDEX "idx_comments_coin" ON "comments" USING btree ("coin_id");--> statement-breakpoint
CREATE INDEX "idx_comments_user" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_comments_deleted" ON "comments" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_invite_code" ON "invite_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_invite_active" ON "invite_codes" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_coin_like" ON "likes" USING btree ("user_id","coin_id");--> statement-breakpoint
CREATE INDEX "idx_likes_user" ON "likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_likes_coin" ON "likes" USING btree ("coin_id");--> statement-breakpoint
CREATE INDEX "idx_user_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_user_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_user_role" ON "users" USING btree ("role");