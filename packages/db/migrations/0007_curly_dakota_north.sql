CREATE TABLE "saludos_cumple" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"anio" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "fecha_nacimiento" date;--> statement-breakpoint
ALTER TABLE "saludos_cumple" ADD CONSTRAINT "saludos_cumple_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saludos_cumple_customer_anio" ON "saludos_cumple" USING btree ("customer_id","anio");