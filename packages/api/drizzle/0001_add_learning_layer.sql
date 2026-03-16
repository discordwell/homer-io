-- Phase 6A: Learning Layer Foundation
-- Creates address_intelligence, delivery_metrics tables and failure_category enum/column

-- Failure category enum
DO $$ BEGIN
  CREATE TYPE "failure_category" AS ENUM (
    'not_home', 'wrong_address', 'access_denied', 'refused',
    'damaged', 'business_closed', 'weather', 'vehicle_issue', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add failure_category column to orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "failure_category" "failure_category";

-- Address intelligence table
CREATE TABLE IF NOT EXISTS "address_intelligence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "address_hash" varchar(64) NOT NULL,
  "address_normalized" jsonb NOT NULL,
  "delivery_lat" numeric(10, 7),
  "delivery_lng" numeric(10, 7),
  "avg_service_time_seconds" numeric(10, 2),
  "successful_deliveries" integer DEFAULT 0 NOT NULL,
  "failed_deliveries" integer DEFAULT 0 NOT NULL,
  "total_deliveries" integer DEFAULT 0 NOT NULL,
  "best_delivery_hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "access_instructions" jsonb,
  "parking_notes" jsonb,
  "customer_preferences" jsonb,
  "common_failure_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "last_delivery_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_address_intelligence_tenant_hash"
  ON "address_intelligence" ("tenant_id", "address_hash");
CREATE INDEX IF NOT EXISTS "idx_address_intelligence_tenant"
  ON "address_intelligence" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_address_intelligence_coords"
  ON "address_intelligence" ("delivery_lat", "delivery_lng");

-- Delivery metrics table
CREATE TABLE IF NOT EXISTS "delivery_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "route_id" uuid REFERENCES "routes"("id") ON DELETE SET NULL,
  "address_intelligence_id" uuid REFERENCES "address_intelligence"("id") ON DELETE SET NULL,
  "estimated_arrival_at" timestamp with time zone,
  "actual_arrival_at" timestamp with time zone,
  "service_time_seconds" integer,
  "eta_error_minutes" numeric(8, 2),
  "estimated_distance_km" numeric(10, 3),
  "actual_distance_km" numeric(10, 3),
  "delivery_status" varchar(20) NOT NULL,
  "failure_category" "failure_category",
  "completed_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_delivery_metrics_tenant"
  ON "delivery_metrics" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_delivery_metrics_order"
  ON "delivery_metrics" ("order_id");
CREATE INDEX IF NOT EXISTS "idx_delivery_metrics_address_intel"
  ON "delivery_metrics" ("address_intelligence_id");
CREATE INDEX IF NOT EXISTS "idx_delivery_metrics_tenant_completed"
  ON "delivery_metrics" ("tenant_id", "completed_at");
