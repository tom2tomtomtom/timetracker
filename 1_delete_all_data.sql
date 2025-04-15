-- SQL script to delete all time entries from both user IDs

-- First, let's check what user IDs exist in the database
SELECT DISTINCT user_id, COUNT(*) FROM time_entries GROUP BY user_id;

-- Delete all existing time entries for both user IDs
DELETE FROM time_entries
WHERE user_id IN ('c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid, '69a377d6-c0f6-42a4-b5b6-bac9f88c90ea'::uuid);

-- Delete any other time entries you want to clean up (optional)
-- If you want to delete ALL time entries in the database, uncomment the line below:
-- DELETE FROM time_entries;

-- Verify deletion
SELECT DISTINCT user_id, COUNT(*) FROM time_entries GROUP BY user_id;
