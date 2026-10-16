CREATE TABLE "campanias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"cuerpo" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campanias" ADD CONSTRAINT "campanias_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campanias_merchant_id_idx" ON "campanias" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "campanias_created_at_idx" ON "campanias" USING btree ("created_at");