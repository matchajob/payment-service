CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'issued', 'dead');--> statement-breakpoint
CREATE TABLE "invoices" (
	"invoice_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" uuid NOT NULL,
	"invoicing_connection_id" uuid NOT NULL,
	"status" "invoice_status" NOT NULL,
	"attempts" integer NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"last_error" varchar(512),
	"invoice_ref" varchar(512),
	"document_url" varchar(256),
	"issued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices__pk__invoice_id" PRIMARY KEY("invoice_id"),
	CONSTRAINT "invoices_one_per_charge" UNIQUE("charge_id"),
	CONSTRAINT "invoices__chk__attempts" CHECK ("attempts" >= 0),
	CONSTRAINT "invoices__chk__last_error" CHECK (length("last_error") >= 1),
	CONSTRAINT "invoices__chk__invoice_ref" CHECK (length("invoice_ref") >= 1),
	CONSTRAINT "invoices__chk__document_url" CHECK (length("document_url") >= 1),
	CONSTRAINT "invoices_issued_has_ref" CHECK (("invoices"."status" = 'issued') = ("invoices"."invoice_ref" is not null and "invoices"."issued_at" is not null)),
	CONSTRAINT "invoices_dead_has_last_error" CHECK ("invoices"."status" <> 'dead' or "invoices"."last_error" is not null)
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices__fk__charge_id" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("charge_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices__fk__invoicing_connection_id" FOREIGN KEY ("invoicing_connection_id") REFERENCES "public"."invoicing_connections"("invoicing_connection_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_due" ON "invoices" USING btree ("next_attempt_at") WHERE "invoices"."status" = 'pending';