CREATE TYPE "public"."invoicing_service" AS ENUM('morning');--> statement-breakpoint
CREATE TABLE "invoicing_connections" (
	"invoicing_connection_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"service" "invoicing_service" NOT NULL,
	"sealed_credentials" varchar(5000000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoicing_connections__pk__invoicing_connection_id" PRIMARY KEY("invoicing_connection_id"),
	CONSTRAINT "invoicing_connections_organization_connection" UNIQUE("organization_id","invoicing_connection_id"),
	CONSTRAINT "invoicing_connections__chk__sealed_credentials" CHECK (length("sealed_credentials") >= 1)
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "invoicing_connection_id" uuid;--> statement-breakpoint
ALTER TABLE "invoicing_connections" ADD CONSTRAINT "invoicing_connections__fk__organization_id" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants__fk__invoicing_connection_id" FOREIGN KEY ("invoicing_connection_id") REFERENCES "public"."invoicing_connections"("invoicing_connection_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_invoicing_connection_same_organization" FOREIGN KEY ("organization_id","invoicing_connection_id") REFERENCES "public"."invoicing_connections"("organization_id","invoicing_connection_id") ON DELETE restrict ON UPDATE no action;