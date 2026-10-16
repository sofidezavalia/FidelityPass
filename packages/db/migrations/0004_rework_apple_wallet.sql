CREATE TABLE "apple_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_library_identifier" text NOT NULL,
	"push_token" text NOT NULL,
	"pass_type_identifier" text NOT NULL,
	"serial_number" text NOT NULL,
	"pass_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "apple_device_registration_unique" UNIQUE("device_library_identifier","pass_type_identifier","serial_number")
);
--> statement-breakpoint
ALTER TABLE "passes" ADD COLUMN "apple_auth_token" text;--> statement-breakpoint
ALTER TABLE "apple_devices" ADD CONSTRAINT "apple_devices_pass_id_passes_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."passes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apple_devices_device_idx" ON "apple_devices" USING btree ("device_library_identifier","pass_type_identifier");--> statement-breakpoint
CREATE INDEX "apple_devices_serial_idx" ON "apple_devices" USING btree ("serial_number");--> statement-breakpoint
ALTER TABLE "passes" DROP COLUMN "apple_pass_id";