-- Phase 7A: Migration Data Model — Schema Changes
-- Adds fields needed for competitor migration (Tookan, Onfleet, OptimoRoute, SpeedyRoute, GetSwift, Circuit)

-- 1. New enum: order_type
DO $$ BEGIN
  CREATE TYPE order_type AS ENUM ('delivery', 'pickup', 'pickup_and_delivery');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Orders table — add 4 columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_duration_minutes integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type order_type NOT NULL DEFAULT 'delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS barcodes jsonb NOT NULL DEFAULT '[]';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}';

-- 3. Drivers table — add external_id
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS external_id varchar(255);

-- 4. Vehicles table — add external_id
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS external_id varchar(255);

-- 5. Partial unique indexes for external_id mapping
CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_tenant_external_id
  ON drivers (tenant_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_tenant_external_id
  ON vehicles (tenant_id, external_id)
  WHERE external_id IS NOT NULL;

-- 6. Extend integration_platform enum with competitor values
DO $$ BEGIN
  ALTER TYPE integration_platform ADD VALUE IF NOT EXISTS 'tookan';
  ALTER TYPE integration_platform ADD VALUE IF NOT EXISTS 'onfleet';
  ALTER TYPE integration_platform ADD VALUE IF NOT EXISTS 'optimoroute';
  ALTER TYPE integration_platform ADD VALUE IF NOT EXISTS 'speedyroute';
  ALTER TYPE integration_platform ADD VALUE IF NOT EXISTS 'getswift';
  ALTER TYPE integration_platform ADD VALUE IF NOT EXISTS 'circuit';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. New table: migration_jobs
CREATE TABLE IF NOT EXISTS migration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_platform varchar(50) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  config jsonb NOT NULL DEFAULT '{}',
  progress jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz,
  completed_at timestamptz,
  error_log jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_migration_jobs_tenant
  ON migration_jobs (tenant_id);

-- 8. New table: integration_drivers
CREATE TABLE IF NOT EXISTS integration_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_job_id uuid NOT NULL REFERENCES migration_jobs(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  external_driver_id varchar(255) NOT NULL,
  platform varchar(50) NOT NULL,
  raw_data jsonb NOT NULL DEFAULT '{}',
  sync_status integration_sync_status NOT NULL DEFAULT 'pending',
  sync_error varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_driver_dedup
  ON integration_drivers (migration_job_id, external_driver_id);

-- 9. New table: integration_vehicles
CREATE TABLE IF NOT EXISTS integration_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_job_id uuid NOT NULL REFERENCES migration_jobs(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  external_vehicle_id varchar(255) NOT NULL,
  platform varchar(50) NOT NULL,
  raw_data jsonb NOT NULL DEFAULT '{}',
  sync_status integration_sync_status NOT NULL DEFAULT 'pending',
  sync_error varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_vehicle_dedup
  ON integration_vehicles (migration_job_id, external_vehicle_id);
