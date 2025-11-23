/*
  # Add error message column to exports table

  1. Changes
    - Add `error_message` column to `exports` table to store detailed error information when exports fail
  
  2. Purpose
    - Allows better debugging and user feedback when video exports fail
    - Stores specific error messages from Shotstack or other processing failures
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exports' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE exports ADD COLUMN error_message text;
  END IF;
END $$;
