CREATE TYPE "public"."charge_kind" AS ENUM('first', 'renewal', 'retry', 'immediate_retry');--> statement-breakpoint
CREATE TYPE "public"."charge_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."reconcile_flag" AS ENUM('stuck_pending', 'ref_not_found', 'no_reference_lookup', 'amount_mismatch', 'late_success');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('ILS', 'USD');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'delivered', 'dead');--> statement-breakpoint
CREATE TYPE "public"."outbound_event_type" AS ENUM('subscription.activated', 'subscription.past_due', 'subscription.canceled', 'charge.succeeded', 'charge.failed');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('grow', 'stripe');--> statement-breakpoint
CREATE TYPE "public"."billing_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."cancel_reason" AS ENUM('payment_failure', 'customer_request', 'already_subscribed', 'checkout_expired');--> statement-breakpoint
CREATE TYPE "public"."schedule_owner" AS ENUM('self', 'external');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('incomplete', 'active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TABLE "charges" (
	"charge_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"charge_serial" bigint GENERATED ALWAYS AS IDENTITY (sequence name "charges_charge_serial_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"payment_method_id" uuid NOT NULL,
	"provider_connection_id" uuid NOT NULL,
	"kind" charge_kind NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"attempt" integer NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" "currency" NOT NULL,
	"status" charge_status NOT NULL,
	"provider_charge_ref" varchar(512),
	"failure_reason" varchar(512),
	"attempted_at" timestamp with time zone NOT NULL,
	"reconcile_flag" "reconcile_flag",
	"flagged_at" timestamp with time zone,
	"reconcile_deferred_at" timestamp with time zone,
	"flag_resolved_at" timestamp with time zone,
	"flag_resolution" varchar(512),
	CONSTRAINT "charges__pk__charge_id" PRIMARY KEY("charge_id"),
	CONSTRAINT "charges_one_per_attempt" UNIQUE("subscription_id","period_end","attempt"),
	CONSTRAINT "charges_charge_serial_unique" UNIQUE("charge_serial"),
	CONSTRAINT "charges__chk__attempt" CHECK ("attempt" >= 0),
	CONSTRAINT "charges__chk__amount_minor" CHECK ("amount_minor" >= 1),
	CONSTRAINT "charges__chk__provider_charge_ref" CHECK (length("provider_charge_ref") >= 1),
	CONSTRAINT "charges__chk__failure_reason" CHECK (length("failure_reason") >= 1),
	CONSTRAINT "charges__chk__flag_resolution" CHECK (length("flag_resolution") >= 1),
	CONSTRAINT "charges_succeeded_has_provider_ref" CHECK ("charges"."status" <> 'succeeded' or "charges"."provider_charge_ref" is not null),
	CONSTRAINT "charges_failure_reason_iff_failed" CHECK (("charges"."status" = 'failed') = ("charges"."failure_reason" is not null)),
	CONSTRAINT "charges_reconcile_flag_iff_flagged_at" CHECK (("charges"."reconcile_flag" is null) = ("charges"."flagged_at" is null)),
	CONSTRAINT "charges_flag_resolution_iff_resolved_at" CHECK (("charges"."flag_resolution" is null) = ("charges"."flag_resolved_at" is null)),
	CONSTRAINT "charges_resolved_only_when_flagged" CHECK ("charges"."flag_resolved_at" is null or "charges"."reconcile_flag" is not null)
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"customer_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"external_ref" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers__pk__customer_id" PRIMARY KEY("customer_id"),
	CONSTRAINT "customers_tenant_external_ref_unique" UNIQUE("tenant_id","external_ref"),
	CONSTRAINT "customers_tenant_pin" UNIQUE("tenant_id","customer_id"),
	CONSTRAINT "customers__chk__external_ref" CHECK (length("external_ref") >= 1)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"idempotency_key_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" uuid NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"reserved_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"response_status" integer,
	"response_content_type" varchar(64),
	"response_body" varchar(5000000) DEFAULT '',
	CONSTRAINT "idempotency_keys__pk__idempotency_key_id" PRIMARY KEY("idempotency_key_id"),
	CONSTRAINT "idempotency_keys_tenant_key_unique" UNIQUE("tenant_id","key"),
	CONSTRAINT "idempotency_keys__chk__request_hash" CHECK (length("request_hash") = 64),
	CONSTRAINT "idempotency_keys__chk__response_status" CHECK ("response_status" >= 100 AND "response_status" <= 599),
	CONSTRAINT "idempotency_keys__chk__response_content_type" CHECK (length("response_content_type") >= 1),
	CONSTRAINT "idempotency_keys_completion_is_whole" CHECK (("idempotency_keys"."completed_at" is null) = ("idempotency_keys"."response_status" is null)
          and ("idempotency_keys"."completed_at" is null) = ("idempotency_keys"."response_content_type" is null)
          and ("idempotency_keys"."completed_at" is null) = ("idempotency_keys"."response_body" is null))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"organization_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations__pk__organization_id" PRIMARY KEY("organization_id"),
	CONSTRAINT "organizations__chk__name" CHECK (length("name") >= 1)
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"outbox_event_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"event_type" "outbound_event_type" NOT NULL,
	"sequence" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"delivery_status" "delivery_status" NOT NULL,
	"attempts" integer NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	"last_error" varchar(512),
	CONSTRAINT "outbox_events__pk__outbox_event_id" PRIMARY KEY("outbox_event_id"),
	CONSTRAINT "outbox_events_one_per_sequence" UNIQUE("subscription_id","sequence"),
	CONSTRAINT "outbox_events__chk__sequence" CHECK ("sequence" >= 1),
	CONSTRAINT "outbox_events__chk__attempts" CHECK ("attempts" >= 0),
	CONSTRAINT "outbox_events__chk__last_error" CHECK (length("last_error") >= 1),
	CONSTRAINT "outbox_events_delivered_at_iff_delivered" CHECK (("outbox_events"."delivery_status" = 'delivered') = ("outbox_events"."delivered_at" is not null)),
	CONSTRAINT "outbox_events_dead_has_last_error" CHECK ("outbox_events"."delivery_status" <> 'dead' or "outbox_events"."last_error" is not null)
);
--> statement-breakpoint
CREATE TABLE "payment_method_updates" (
	"payment_method_update_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"provider_connection_id" uuid NOT NULL,
	"session_ref" varchar(512) NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "payment_method_updates__pk__payment_method_update_id" PRIMARY KEY("payment_method_update_id"),
	CONSTRAINT "payment_method_updates_one_per_session" UNIQUE("provider_connection_id","session_ref"),
	CONSTRAINT "payment_method_updates__chk__session_ref" CHECK (length("session_ref") >= 1)
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"payment_method_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"provider_connection_id" uuid NOT NULL,
	"provider_token" varchar(512) NOT NULL,
	"capture_ref" varchar(512) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replaced_at" timestamp with time zone,
	CONSTRAINT "payment_methods__pk__payment_method_id" PRIMARY KEY("payment_method_id"),
	CONSTRAINT "payment_methods_one_per_capture" UNIQUE("tenant_id","capture_ref"),
	CONSTRAINT "payment_methods_connection_pin" UNIQUE("payment_method_id","provider_connection_id"),
	CONSTRAINT "payment_methods_subscription_pin" UNIQUE("subscription_id","payment_method_id"),
	CONSTRAINT "payment_methods__chk__provider_token" CHECK (length("provider_token") >= 1),
	CONSTRAINT "payment_methods__chk__capture_ref" CHECK (length("capture_ref") >= 1)
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"plan_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" "currency" NOT NULL,
	"interval" "billing_interval" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans__pk__plan_id" PRIMARY KEY("plan_id"),
	CONSTRAINT "plans_tenant_pin" UNIQUE("tenant_id","plan_id"),
	CONSTRAINT "plans__chk__name" CHECK (length("name") >= 1),
	CONSTRAINT "plans__chk__amount_minor" CHECK ("amount_minor" >= 1)
);
--> statement-breakpoint
CREATE TABLE "provider_connections" (
	"provider_connection_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"sealed_credentials" varchar(5000000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_connections__pk__provider_connection_id" PRIMARY KEY("provider_connection_id"),
	CONSTRAINT "provider_connections_organization_connection" UNIQUE("organization_id","provider_connection_id"),
	CONSTRAINT "provider_connections__chk__sealed_credentials" CHECK (length("sealed_credentials") >= 1)
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"subscription_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"provider_connection_id" uuid NOT NULL,
	"status" "subscription_status" NOT NULL,
	"schedule_owner" "schedule_owner" NOT NULL,
	"checkout_session_ref" varchar(512),
	"current_period_end" timestamp with time zone,
	"anchor_day" integer,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"cancel_reason" "cancel_reason",
	"dunning_attempt" integer DEFAULT 0 NOT NULL,
	"dunning_attempt_base" integer DEFAULT 0 NOT NULL,
	"dunning_started_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"cycle_deferred_at" timestamp with time zone,
	"sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions__pk__subscription_id" PRIMARY KEY("subscription_id"),
	CONSTRAINT "subscriptions_connection_pin" UNIQUE("subscription_id","provider_connection_id"),
	CONSTRAINT "subscriptions_tenant_pin" UNIQUE("tenant_id","subscription_id"),
	CONSTRAINT "subscriptions__chk__checkout_session_ref" CHECK (length("checkout_session_ref") >= 1),
	CONSTRAINT "subscriptions__chk__anchor_day" CHECK ("anchor_day" >= 1 AND "anchor_day" <= 31),
	CONSTRAINT "subscriptions__chk__dunning_attempt" CHECK ("dunning_attempt" >= 0),
	CONSTRAINT "subscriptions__chk__dunning_attempt_base" CHECK ("dunning_attempt_base" >= 0),
	CONSTRAINT "subscriptions__chk__sequence" CHECK ("sequence" >= 0),
	CONSTRAINT "subscriptions_cancel_flag_only_on_active" CHECK ("subscriptions"."cancel_at_period_end" = false or "subscriptions"."status" = 'active'),
	CONSTRAINT "subscriptions_incomplete_has_no_period" CHECK ("subscriptions"."status" <> 'incomplete' or "subscriptions"."current_period_end" is null),
	CONSTRAINT "subscriptions_live_has_period" CHECK ("subscriptions"."status" not in ('active', 'past_due') or "subscriptions"."current_period_end" is not null),
	CONSTRAINT "subscriptions_retry_iff_past_due" CHECK (("subscriptions"."status" = 'past_due') = ("subscriptions"."next_retry_at" is not null)),
	CONSTRAINT "subscriptions_dunning_clock_with_retry" CHECK (("subscriptions"."next_retry_at" is null) = ("subscriptions"."dunning_started_at" is null)),
	CONSTRAINT "subscriptions_dunning_base_within_attempts" CHECK ("subscriptions"."dunning_attempt_base" <= "subscriptions"."dunning_attempt"),
	CONSTRAINT "subscriptions_cancel_reason_iff_canceled" CHECK (("subscriptions"."status" = 'canceled') = ("subscriptions"."cancel_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"tenant_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider_connection_id" uuid NOT NULL,
	"slug" varchar(64) NOT NULL,
	"time_zone" varchar(32) DEFAULT 'UTC' NOT NULL,
	"api_key_hash" varchar(64) NOT NULL,
	"webhook_url" varchar(256) NOT NULL,
	"webhook_secret" varchar(512) NOT NULL,
	"checkout_ttl_hours" integer NOT NULL,
	"resume_allowed" boolean NOT NULL,
	"grace_entitlement" boolean NOT NULL,
	"dunning_schedule_days" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants__pk__tenant_id" PRIMARY KEY("tenant_id"),
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tenants_api_key_hash_unique" UNIQUE("api_key_hash"),
	CONSTRAINT "tenants__chk__slug" CHECK (length("slug") >= 1),
	CONSTRAINT "tenants__chk__time_zone" CHECK (length("time_zone") >= 1),
	CONSTRAINT "tenants__chk__api_key_hash" CHECK (length("api_key_hash") = 64),
	CONSTRAINT "tenants__chk__webhook_url" CHECK (length("webhook_url") >= 1),
	CONSTRAINT "tenants__chk__webhook_secret" CHECK (length("webhook_secret") >= 1),
	CONSTRAINT "tenants__chk__checkout_ttl_hours" CHECK ("checkout_ttl_hours" >= 1)
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"webhook_event_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"provider_connection_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"dedup_key" varchar(64) NOT NULL,
	"raw_body" varchar(5000000) DEFAULT '' NOT NULL,
	"trusted" boolean NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "webhook_events__pk__webhook_event_id" PRIMARY KEY("webhook_event_id"),
	CONSTRAINT "webhook_events_dedup" UNIQUE("provider_connection_id","dedup_key"),
	CONSTRAINT "webhook_events__chk__dedup_key" CHECK (length("dedup_key") = 64)
);
--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges__fk__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges__fk__subscription_id" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("subscription_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges__fk__payment_method_id" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("payment_method_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges__fk__provider_connection_id" FOREIGN KEY ("provider_connection_id") REFERENCES "public"."provider_connections"("provider_connection_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_subscription_same_tenant" FOREIGN KEY ("tenant_id","subscription_id") REFERENCES "public"."subscriptions"("tenant_id","subscription_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_card_of_subscription" FOREIGN KEY ("subscription_id","payment_method_id") REFERENCES "public"."payment_methods"("subscription_id","payment_method_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_subscription_connection" FOREIGN KEY ("subscription_id","provider_connection_id") REFERENCES "public"."subscriptions"("subscription_id","provider_connection_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_payment_method_connection" FOREIGN KEY ("payment_method_id","provider_connection_id") REFERENCES "public"."payment_methods"("payment_method_id","provider_connection_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers__fk__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys__fk__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events__fk__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events__fk__subscription_id" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("subscription_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_subscription_same_tenant" FOREIGN KEY ("tenant_id","subscription_id") REFERENCES "public"."subscriptions"("tenant_id","subscription_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_method_updates" ADD CONSTRAINT "payment_method_updates__fk__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_method_updates" ADD CONSTRAINT "payment_method_updates__fk__subscription_id" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("subscription_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_method_updates" ADD CONSTRAINT "payment_method_updates__fk__provider_connection_id" FOREIGN KEY ("provider_connection_id") REFERENCES "public"."provider_connections"("provider_connection_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_method_updates" ADD CONSTRAINT "payment_method_updates_subscription_same_tenant" FOREIGN KEY ("tenant_id","subscription_id") REFERENCES "public"."subscriptions"("tenant_id","subscription_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_method_updates" ADD CONSTRAINT "payment_method_updates_subscription_connection" FOREIGN KEY ("subscription_id","provider_connection_id") REFERENCES "public"."subscriptions"("subscription_id","provider_connection_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods__fk__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods__fk__subscription_id" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("subscription_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods__fk__provider_connection_id" FOREIGN KEY ("provider_connection_id") REFERENCES "public"."provider_connections"("provider_connection_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_subscription_same_tenant" FOREIGN KEY ("tenant_id","subscription_id") REFERENCES "public"."subscriptions"("tenant_id","subscription_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_subscription_connection" FOREIGN KEY ("subscription_id","provider_connection_id") REFERENCES "public"."subscriptions"("subscription_id","provider_connection_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans__fk__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections__fk__organization_id" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions__fk__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions__fk__customer_id" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions__fk__plan_id" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("plan_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions__fk__provider_connection_id" FOREIGN KEY ("provider_connection_id") REFERENCES "public"."provider_connections"("provider_connection_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_same_tenant" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_same_tenant" FOREIGN KEY ("tenant_id","plan_id") REFERENCES "public"."plans"("tenant_id","plan_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants__fk__organization_id" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants__fk__provider_connection_id" FOREIGN KEY ("provider_connection_id") REFERENCES "public"."provider_connections"("provider_connection_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_connection_same_organization" FOREIGN KEY ("organization_id","provider_connection_id") REFERENCES "public"."provider_connections"("organization_id","provider_connection_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events__fk__provider_connection_id" FOREIGN KEY ("provider_connection_id") REFERENCES "public"."provider_connections"("provider_connection_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "charges_one_live_per_period" ON "charges" USING btree ("subscription_id","period_end") WHERE "charges"."status" in ('pending', 'succeeded');--> statement-breakpoint
CREATE INDEX "outbox_events_due" ON "outbox_events" USING btree ("next_attempt_at") WHERE "outbox_events"."delivery_status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_one_current_per_subscription" ON "payment_methods" USING btree ("subscription_id") WHERE "payment_methods"."replaced_at" is null;--> statement-breakpoint
CREATE INDEX "subscriptions_next_retry_at" ON "subscriptions" USING btree ("next_retry_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_one_live_per_customer" ON "subscriptions" USING btree ("customer_id") WHERE "subscriptions"."status" in ('active', 'past_due');