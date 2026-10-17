ALTER TABLE "merchants" ADD COLUMN "bono_cumpleanios" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "pedir_ticket" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "max_unidades_por_ticket" integer;--> statement-breakpoint
ALTER TABLE "campanias" ADD COLUMN "segmento" text DEFAULT 'todos' NOT NULL;--> statement-breakpoint
CREATE INDEX "campanias_segmento_idx" ON "campanias" USING btree ("segmento");--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"nro_ticket" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_merchant_id_nro_ticket_unique" ON "tickets" USING btree ("merchant_id","nro_ticket");--> statement-breakpoint
CREATE INDEX "tickets_merchant_id_idx" ON "tickets" USING btree ("merchant_id");
