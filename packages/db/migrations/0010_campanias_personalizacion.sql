ALTER TABLE "merchants" ADD COLUMN "hero_url" text;--> statement-breakpoint
ALTER TABLE "passes" ADD COLUMN "es_prueba" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campanias" ADD COLUMN "estado" text DEFAULT 'borrador' NOT NULL;--> statement-breakpoint
ALTER TABLE "campanias" ADD COLUMN "programada_para" timestamp;--> statement-breakpoint
CREATE INDEX "campanias_programada_para_idx" ON "campanias" USING btree ("programada_para");--> statement-breakpoint
UPDATE "campanias" SET "estado" = 'enviada' WHERE "estado" = 'borrador';
