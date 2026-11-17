ALTER TABLE "customers" ADD COLUMN "name" varchar(64);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "email" varchar(254);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "tax_id" varchar(64);--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers__chk__name" CHECK (length("name") >= 1);--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers__chk__email" CHECK (length("email") >= 1);--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers__chk__tax_id" CHECK (length("tax_id") >= 1);