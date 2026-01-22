ALTER TABLE "trade_shipping" ADD COLUMN "initiator_address" text;--> statement-breakpoint
ALTER TABLE "trade_shipping" ADD COLUMN "owner_address" text;--> statement-breakpoint
ALTER TABLE "trade_shipping" ADD COLUMN "addresses_exchanged" boolean DEFAULT false NOT NULL;