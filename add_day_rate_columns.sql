-- SQL script to add day rate columns to time_entries table

-- Add days column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'time_entries' AND column_name = 'days'
    ) THEN
        ALTER TABLE time_entries ADD COLUMN days NUMERIC(5,2);
    END IF;
END $$;

-- Add day_rate column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'time_entries' AND column_name = 'day_rate'
    ) THEN
        ALTER TABLE time_entries ADD COLUMN day_rate NUMERIC(10,2);
    END IF;
END $$;

-- Verify columns
SELECT column_name FROM information_schema.columns WHERE table_name = 'time_entries' AND column_name IN ('days','day_rate');
