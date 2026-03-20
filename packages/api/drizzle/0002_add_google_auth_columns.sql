-- Add Google auth columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" varchar(255) UNIQUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" varchar(500);

-- Add org domain and demo columns to tenants table
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "org_domain" varchar(255);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "auto_join_enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "is_demo" boolean DEFAULT false NOT NULL;

-- Index for org domain lookups
CREATE INDEX IF NOT EXISTS "idx_tenants_org_domain" ON "tenants" ("org_domain");
