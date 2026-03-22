-- ID verification columns on proof_of_delivery
ALTER TABLE proof_of_delivery ADD COLUMN IF NOT EXISTS id_photo_url text;
ALTER TABLE proof_of_delivery ADD COLUMN IF NOT EXISTS id_number varchar(50);
ALTER TABLE proof_of_delivery ADD COLUMN IF NOT EXISTS id_dob date;
ALTER TABLE proof_of_delivery ADD COLUMN IF NOT EXISTS id_expiration_date date;
ALTER TABLE proof_of_delivery ADD COLUMN IF NOT EXISTS id_name_on_id varchar(255);
ALTER TABLE proof_of_delivery ADD COLUMN IF NOT EXISTS id_verified_at timestamptz;
ALTER TABLE proof_of_delivery ADD COLUMN IF NOT EXISTS age_verified boolean DEFAULT false NOT NULL;

-- Delivery manifests
DO $$ BEGIN
  CREATE TYPE manifest_status AS ENUM ('draft', 'active', 'completed', 'voided');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS delivery_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  manifest_number varchar(50) NOT NULL,
  status manifest_status NOT NULL DEFAULT 'draft',
  license_number varchar(100),
  driver_license_number varchar(50),
  vehicle_license_plate varchar(20),
  departed_at timestamptz,
  returned_at timestamptz,
  total_items integer DEFAULT 0,
  total_value numeric(10,2),
  total_weight numeric(10,2),
  items jsonb NOT NULL DEFAULT '[]',
  pdf_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manifests_tenant_number ON delivery_manifests(tenant_id, manifest_number);
CREATE INDEX IF NOT EXISTS idx_manifests_tenant_route ON delivery_manifests(tenant_id, route_id);
