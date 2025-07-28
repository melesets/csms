-- Migration: Ensure users table has required fields and constraints
ALTER TABLE users
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN username SET NOT NULL,
  ALTER COLUMN password SET NOT NULL,
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN department SET NOT NULL,
  ALTER COLUMN isActive SET DEFAULT TRUE;

-- Ensure username is unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'users_username_key'
  ) THEN
    CREATE UNIQUE INDEX users_username_key ON users(username);
  END IF;
END$$;

-- Add permissions column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='permissions'
  ) THEN
    ALTER TABLE users ADD COLUMN permissions JSONB;
  END IF;
END$$;
