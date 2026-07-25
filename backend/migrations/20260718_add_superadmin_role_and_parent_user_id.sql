-- Migration: Add superadmin role and parent_user_id for nested user-staff hierarchy
-- Date: 2026-07-18

-- 1. Add parent_user_id column to users table (links staff to their parent user/service unit)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='parent_user_id'
  ) THEN
    ALTER TABLE users ADD COLUMN parent_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END$$;

-- 2. Create index on parent_user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_users_parent_user_id ON users(parent_user_id);

-- 3. Seed a default superadmin account (password: superadmin123 - should be changed on first login)
-- bcrypt hash of 'superadmin123'
INSERT INTO users (username, password, name, email, role, department, isactive, created_at)
VALUES (
  'superadmin',
  '$2b$10$YQ8GvFOCwPjKhKHuFpJhZeQxVpGfn1WzGqYmKXy3hLz5kN7mO9pQr',
  'Super Administrator',
  'superadmin@isbar.local',
  'superadmin',
  'System',
  TRUE,
  NOW()
) ON CONFLICT (username) DO NOTHING;
  