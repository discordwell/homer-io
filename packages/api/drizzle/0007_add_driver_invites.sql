-- Driver quick-invite tokens (seasonal temp drivers)
CREATE TABLE IF NOT EXISTS driver_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token varchar(64) NOT NULL UNIQUE,
  created_by uuid,
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  redeemed_by_user_id uuid,
  redeemed_by_driver_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_invites_token ON driver_invites(token);
CREATE INDEX IF NOT EXISTS idx_driver_invites_tenant ON driver_invites(tenant_id);
