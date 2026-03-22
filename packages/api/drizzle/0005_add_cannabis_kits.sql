-- Driver kits (cannabis inventory tracking per route)
DO $$ BEGIN
  CREATE TYPE kit_status AS ENUM ('loading', 'loaded', 'in_transit', 'reconciling', 'reconciled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS driver_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  manifest_id uuid REFERENCES delivery_manifests(id) ON DELETE SET NULL,
  status kit_status NOT NULL DEFAULT 'loading',
  loaded_at timestamptz,
  reconciled_at timestamptz,
  total_items_loaded integer DEFAULT 0,
  total_value_loaded numeric(10,2),
  total_weight_loaded numeric(10,2),
  items jsonb NOT NULL DEFAULT '[]',
  returned_items jsonb NOT NULL DEFAULT '[]',
  reconciled_by uuid,
  discrepancies jsonb DEFAULT '[]',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kits_tenant_route ON driver_kits(tenant_id, route_id);
CREATE INDEX IF NOT EXISTS idx_kits_tenant_driver ON driver_kits(tenant_id, driver_id);

-- Cash-on-delivery columns on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_amount numeric(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_collected numeric(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method varchar(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_collected_at timestamptz;
