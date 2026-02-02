-- Cleanup duplicate emails in user table
-- This migration:
-- 1. Deletes duplicate email records, keeping only the newest one per email
-- 2. The UNIQUE constraint on email is already defined in the schema and will be enforced by the database

-- Delete duplicate email records, keeping only the newest one per email
-- Using case-insensitive email comparison to catch all duplicates
DELETE FROM "user"
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      LOWER(email) as email_lower,
      ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY created_at DESC) as rn
    FROM "user"
    WHERE email IS NOT NULL
  ) ranked
  WHERE rn > 1
);
