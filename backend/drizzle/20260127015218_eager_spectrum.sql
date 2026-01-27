CREATE TABLE "subscription_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"product_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"original_transaction_id" text,
	"purchase_date" timestamp NOT NULL,
	"expires_date" timestamp NOT NULL,
	"receipt" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coins" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_receipts" ADD CONSTRAINT "subscription_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_receipt_transaction_id" ON "subscription_receipts" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_receipt_user_id" ON "subscription_receipts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_receipt_platform" ON "subscription_receipts" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "idx_receipt_is_active" ON "subscription_receipts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_receipt_expires_date" ON "subscription_receipts" USING btree ("expires_date");