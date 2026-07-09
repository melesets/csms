-- Add profile_picture column to users if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile_picture'
  ) THEN
    ALTER TABLE users ADD COLUMN profile_picture VARCHAR(255);
  END IF;
END$$;

-- Add shift_session_id to inventory_reports if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='inventory_reports' AND column_name='shift_session_id'
  ) THEN
    ALTER TABLE inventory_reports ADD COLUMN shift_session_id INTEGER;
  END IF;
END$$;

-- Add email column to users if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email'
  ) THEN
    ALTER TABLE users ADD COLUMN email VARCHAR(100);
  END IF;
END$$;

-- Add name column to users if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='name'
  ) THEN
    ALTER TABLE users ADD COLUMN name VARCHAR(100);
  END IF;
END$$;

-- Add department column to users if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='department'
  ) THEN
    ALTER TABLE users ADD COLUMN department VARCHAR(100);
  END IF;
END$$;

-- Add profession column to users if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profession'
  ) THEN
    ALTER TABLE users ADD COLUMN profession VARCHAR(100);
  END IF;
END$$;

-- Add pin_hash column to users if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='pin_hash'
  ) THEN
    ALTER TABLE users ADD COLUMN pin_hash VARCHAR(255);
  END IF;
END$$;

-- Add has_pin column to users if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='has_pin'
  ) THEN
    ALTER TABLE users ADD COLUMN has_pin BOOLEAN DEFAULT FALSE;
  END IF;
END$$;

-- Add created_by column to users if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='created_by'
  ) THEN
    ALTER TABLE users ADD COLUMN created_by VARCHAR(100);
  END IF;
END$$;

-- Add shift_type column to users if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='shift_type'
  ) THEN
    ALTER TABLE users ADD COLUMN shift_type VARCHAR(10) DEFAULT 'TID';
  END IF;
END$$;

-- Add active_shift_id column to users if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='active_shift_id'
  ) THEN
    ALTER TABLE users ADD COLUMN active_shift_id INTEGER;
  END IF;
END$$;
