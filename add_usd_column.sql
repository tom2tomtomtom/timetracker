-- SQL script to add USD conversion column to time_entries table

-- First, check if the column already exists
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'time_entries' AND column_name = 'amount_usd';

-- Add the USD amount column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'time_entries' AND column_name = 'amount_usd'
    ) THEN
        ALTER TABLE time_entries
        ADD COLUMN amount_usd DECIMAL(10, 2);
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'time_entries' AND column_name = 'amount_usd';
