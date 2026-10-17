ALTER TABLE "merchants" ADD COLUMN "modo_acumulacion" text DEFAULT 'sello_por_visita' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "monto_minimo_sello" numeric;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "monto_por_sello" numeric;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "puntos_por_unidad" numeric;--> statement-breakpoint
ALTER TABLE "rewards" RENAME COLUMN "sellos_requeridos" TO "costo";--> statement-breakpoint
ALTER TABLE "redemptions" RENAME COLUMN "sellos_usados" TO "unidades_usadas";--> statement-breakpoint
CREATE TABLE "points_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pass_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"staff_id" uuid,
	"puntos" integer NOT NULL,
	"monto_compra" numeric,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_pass_id_passes_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."passes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "points_ledger_pass_id_idx" ON "points_ledger" USING btree ("pass_id");--> statement-breakpoint
CREATE INDEX "points_ledger_merchant_id_idx" ON "points_ledger" USING btree ("merchant_id");
