ALTER TABLE feedback ADD COLUMN IF NOT EXISTS target_user_id integer;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS target_role text;