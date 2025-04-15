-- SQL script to update currency settings from USD to AUD

-- First, let's check your current settings
SELECT * FROM settings
WHERE user_id = '69a377d6-c0f6-42a4-b5b6-bac9f88c90ea'::uuid;

-- Update currency to AUD for your user
UPDATE settings
SET currency = 'AUD'
WHERE user_id = '69a377d6-c0f6-42a4-b5b6-bac9f88c90ea'::uuid;

-- If no settings exist for the user, insert default settings with AUD
INSERT INTO settings (
  user_id, default_rate, default_payment_terms, name, email, address, 
  payment_instructions, banking_details, theme, date_format, currency
)
SELECT 
  '69a377d6-c0f6-42a4-b5b6-bac9f88c90ea'::uuid, 350, 'Net 30', '', '', '',
  '', '', 'auto', 'MM/DD/YYYY', 'AUD'
WHERE NOT EXISTS (
  SELECT 1 FROM settings WHERE user_id = '69a377d6-c0f6-42a4-b5b6-bac9f88c90ea'::uuid
);

-- Verify the settings were updated
SELECT * FROM settings
WHERE user_id = '69a377d6-c0f6-42a4-b5b6-bac9f88c90ea'::uuid;
