ALTER TABLE "customers" ADD COLUMN "telefono" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "consentimiento_marketing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "marketing_consent_at" timestamp;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "bono_bienvenida" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "passes" ADD COLUMN "codigo_corto" text;--> statement-breakpoint
DO $$
DECLARE
  r RECORD;
  new_code text;
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  i integer;
  collision boolean;
BEGIN
  FOR r IN SELECT id FROM passes WHERE codigo_corto IS NULL LOOP
    LOOP
      new_code := '';
      FOR i IN 1..6 LOOP
        new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
      END LOOP;
      SELECT EXISTS(SELECT 1 FROM passes WHERE codigo_corto = new_code) INTO collision;
      IF NOT collision THEN
        EXIT;
      END IF;
    END LOOP;
    UPDATE passes SET codigo_corto = new_code WHERE id = r.id;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "passes" ALTER COLUMN "codigo_corto" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_codigo_corto_unique" UNIQUE("codigo_corto");
