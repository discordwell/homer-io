-- Grocery: substitution + temperature zones
ALTER TABLE orders ADD COLUMN IF NOT EXISTS substitution_allowed boolean DEFAULT true NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS substitution_notes text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS temperature_zone varchar(20); -- 'frozen','refrigerated','ambient'

-- Furniture: crew + assembly + haul-away
ALTER TABLE orders ADD COLUMN IF NOT EXISTS crew_size integer DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assembly_required boolean DEFAULT false NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS haul_away boolean DEFAULT false NOT NULL;

-- Add new integration platforms
DO $$ BEGIN
  ALTER TYPE integration_platform ADD VALUE IF NOT EXISTS 'square';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE integration_platform ADD VALUE IF NOT EXISTS 'toast';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
