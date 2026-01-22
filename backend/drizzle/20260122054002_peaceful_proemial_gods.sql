CREATE TABLE "trade_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"rater_id" text NOT NULL,
	"rated_user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade_ratings" ADD CONSTRAINT "trade_ratings_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_ratings" ADD CONSTRAINT "trade_ratings_rater_id_users_id_fk" FOREIGN KEY ("rater_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_ratings" ADD CONSTRAINT "trade_ratings_rated_user_id_users_id_fk" FOREIGN KEY ("rated_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_trade_rating_unique" ON "trade_ratings" USING btree ("trade_id","rater_id");--> statement-breakpoint
CREATE INDEX "idx_trade_rating_trade" ON "trade_ratings" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "idx_trade_rating_rater" ON "trade_ratings" USING btree ("rater_id");--> statement-breakpoint
CREATE INDEX "idx_trade_rating_rated" ON "trade_ratings" USING btree ("rated_user_id");