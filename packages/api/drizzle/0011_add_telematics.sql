-- Telematics adapter foundation: Samsara/Motive/Geotab fleet-tracking connections,
-- upstream vehicle/driver mirrors, position stream, sync bookkeeping.
-- Positions from these providers merge with the existing driver-app feed via
-- a source-aware mergePosition() helper. 30-day retention on telematics_positions.

DO $$ BEGIN
  CREATE TYPE telematics_provider AS ENUM ('samsara', 'motive', 'geotab');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE telematics_connection_status AS ENUM ('active', 'pending_reauth', 'error', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE telematics_sync_domain AS ENUM ('vehicles', 'drivers', 'positions');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE location_source AS ENUM ('driver_app', 'samsara', 'motive', 'geotab');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS telematics_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider telematics_provider NOT NULL,
  auth_material jsonb NOT NULL, -- AES-256-GCM encrypted: { access_token, refresh_token, ... }
  refresh_token_expires_at timestamptz,
  external_org_id varchar(255),
  account_name varchar(255),
  status telematics_connection_status NOT NULL DEFAULT 'active',
  disabled_reason varchar(500),
  last_sync_at timestamptz,
  webhook_id varchar(255),
  webhook_secret varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_telematics_connection_tenant_provider
  ON telematics_connections(tenant_id, provider);
CREATE INDEX IF NOT EXISTS idx_telematics_connections_status
  ON telematics_connections(status);

CREATE TABLE IF NOT EXISTS telematics_external_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES telematics_connections(id) ON DELETE CASCADE,
  external_vehicle_id varchar(255) NOT NULL,
  mapped_vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  vin varchar(32),
  plate varchar(32),
  name varchar(255),
  make varchar(100),
  model varchar(100),
  year integer,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_telematics_external_vehicle
  ON telematics_external_vehicles(connection_id, external_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_telematics_external_vehicles_mapped
  ON telematics_external_vehicles(mapped_vehicle_id) WHERE mapped_vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_telematics_external_vehicles_vin
  ON telematics_external_vehicles(vin) WHERE vin IS NOT NULL;

CREATE TABLE IF NOT EXISTS telematics_external_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES telematics_connections(id) ON DELETE CASCADE,
  external_driver_id varchar(255) NOT NULL,
  mapped_driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  name varchar(255),
  email varchar(255),
  phone varchar(32),
  license_number varchar(64),
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_telematics_external_driver
  ON telematics_external_drivers(connection_id, external_driver_id);
CREATE INDEX IF NOT EXISTS idx_telematics_external_drivers_mapped
  ON telematics_external_drivers(mapped_driver_id) WHERE mapped_driver_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS telematics_positions (
  id bigserial PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES telematics_connections(id) ON DELETE CASCADE,
  external_vehicle_id varchar(255) NOT NULL,
  lat numeric(10, 7) NOT NULL,
  lng numeric(10, 7) NOT NULL,
  speed numeric(6, 2),
  heading integer,
  recorded_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telematics_positions_conn_vehicle_ts
  ON telematics_positions(connection_id, external_vehicle_id, recorded_at DESC);
-- Supports 30-day retention prune
CREATE INDEX IF NOT EXISTS idx_telematics_positions_recorded_at
  ON telematics_positions(recorded_at);

CREATE TABLE IF NOT EXISTS telematics_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES telematics_connections(id) ON DELETE CASCADE,
  domain telematics_sync_domain NOT NULL,
  cursor varchar(500),
  watermark timestamptz,
  last_run_at timestamptz,
  last_error varchar(1000),
  next_due_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_telematics_sync_state
  ON telematics_sync_state(connection_id, domain);
CREATE INDEX IF NOT EXISTS idx_telematics_sync_state_due
  ON telematics_sync_state(next_due_at);

-- Tracks when driver-app and telematics positions disagree (>500m in same 60s window).
-- Purely diagnostic; driver-app wins the merge conflict.
CREATE TABLE IF NOT EXISTS location_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  source_a location_source NOT NULL,
  source_b location_source NOT NULL,
  distance_meters numeric(10, 2) NOT NULL,
  lat_a numeric(10, 7) NOT NULL,
  lng_a numeric(10, 7) NOT NULL,
  lat_b numeric(10, 7) NOT NULL,
  lng_b numeric(10, 7) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_location_conflicts_tenant_ts
  ON location_conflicts(tenant_id, recorded_at DESC);

-- Extend location_history with source attribution. Existing rows are driver_app.
ALTER TABLE location_history
  ADD COLUMN IF NOT EXISTS source location_source NOT NULL DEFAULT 'driver_app';

-- Vehicles can now carry a last known position independent of any assigned driver
-- (truck sitting idle with telematics still pinging).
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS last_lat numeric(10, 7);
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS last_lng numeric(10, 7);
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS last_location_at timestamptz;
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS last_location_source location_source;
