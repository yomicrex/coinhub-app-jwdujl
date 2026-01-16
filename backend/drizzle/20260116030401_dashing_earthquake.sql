CREATE TABLE "trade_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"offerer_id" text NOT NULL,
	"offered_coin_id" uuid,
	"is_counter_offer" boolean DEFAULT false NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"reporter_id" text NOT NULL,
	"reported_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_shipping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"initiator_shipped" boolean DEFAULT false NOT NULL,
	"initiator_tracking_number" text,
	"initiator_shipped_at" timestamp,
	"initiator_received" boolean DEFAULT false NOT NULL,
	"initiator_received_at" timestamp,
	"owner_shipped" boolean DEFAULT false NOT NULL,
	"owner_tracking_number" text,
	"owner_shipped_at" timestamp,
	"owner_received" boolean DEFAULT false NOT NULL,
	"owner_received_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trade_shipping_trade_id_unique" UNIQUE("trade_id")
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"initiator_id" text NOT NULL,
	"coin_owner_id" text NOT NULL,
	"coin_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade_messages" ADD CONSTRAINT "trade_messages_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_messages" ADD CONSTRAINT "trade_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_offers" ADD CONSTRAINT "trade_offers_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_offers" ADD CONSTRAINT "trade_offers_offerer_id_users_id_fk" FOREIGN KEY ("offerer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_offers" ADD CONSTRAINT "trade_offers_offered_coin_id_coins_id_fk" FOREIGN KEY ("offered_coin_id") REFERENCES "public"."coins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_reports" ADD CONSTRAINT "trade_reports_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_reports" ADD CONSTRAINT "trade_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_reports" ADD CONSTRAINT "trade_reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_reports" ADD CONSTRAINT "trade_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_shipping" ADD CONSTRAINT "trade_shipping_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_initiator_id_users_id_fk" FOREIGN KEY ("initiator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_coin_owner_id_users_id_fk" FOREIGN KEY ("coin_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_coin_id_coins_id_fk" FOREIGN KEY ("coin_id") REFERENCES "public"."coins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_trade_message_trade" ON "trade_messages" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "idx_trade_message_sender" ON "trade_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_trade_message_created" ON "trade_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_trade_offer_trade" ON "trade_offers" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "idx_trade_offer_offerer" ON "trade_offers" USING btree ("offerer_id");--> statement-breakpoint
CREATE INDEX "idx_trade_offer_coin" ON "trade_offers" USING btree ("offered_coin_id");--> statement-breakpoint
CREATE INDEX "idx_trade_offer_status" ON "trade_offers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_trade_report_trade" ON "trade_reports" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "idx_trade_report_reporter" ON "trade_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "idx_trade_report_reported" ON "trade_reports" USING btree ("reported_user_id");--> statement-breakpoint
CREATE INDEX "idx_trade_report_status" ON "trade_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_trade_shipping_trade" ON "trade_shipping" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "idx_trade_initiator" ON "trades" USING btree ("initiator_id");--> statement-breakpoint
CREATE INDEX "idx_trade_coin_owner" ON "trades" USING btree ("coin_owner_id");--> statement-breakpoint
CREATE INDEX "idx_trade_coin" ON "trades" USING btree ("coin_id");--> statement-breakpoint
CREATE INDEX "idx_trade_status" ON "trades" USING btree ("status");