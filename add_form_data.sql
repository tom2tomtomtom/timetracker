-- Migration to add form_data column to the settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT NULL;

-- Run this migration script in the Supabase SQL Editor to update the existing database schema
-- This adds the form_data column without affecting existing data