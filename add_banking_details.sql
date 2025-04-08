-- SQL to add banking_details column to the settings table
ALTER TABLE settings ADD COLUMN banking_details TEXT;

-- If you want to update any existing rows to have default empty values
UPDATE settings SET banking_details = '' WHERE banking_details IS NULL;

-- Comment for verification after running:
-- Run this to check that the column was added correctly:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'settings' ORDER BY ordinal_position;