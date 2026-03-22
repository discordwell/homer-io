-- Pharmacy-specific columns on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_controlled_substance boolean DEFAULT false NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS controlled_schedule varchar(10);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_cold_chain boolean DEFAULT false NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cold_chain_confirmed boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS patient_dob date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS patient_dob_verified boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prescriber_name varchar(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prescriber_npi varchar(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS hipaa_safe_notes text;
