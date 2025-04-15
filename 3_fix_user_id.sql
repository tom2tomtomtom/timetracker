-- SQL script to move all time entries to your current user ID

-- First, let's check what entries exist under both user IDs
SELECT user_id, COUNT(*) FROM time_entries 
GROUP BY user_id;

-- Move all data from the inaccessible user to your current user ID
UPDATE time_entries
SET user_id = '69a377d6-c0f6-42a4-b5b6-bac9f88c90ea'::uuid
WHERE user_id = 'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid;

-- Verify the update worked
SELECT user_id, COUNT(*) FROM time_entries 
GROUP BY user_id;

-- Show the updated time entries
SELECT id, date, description, client, project, hours, rate, amount 
FROM time_entries 
WHERE user_id = '69a377d6-c0f6-42a4-b5b6-bac9f88c90ea'::uuid
ORDER BY date DESC;
