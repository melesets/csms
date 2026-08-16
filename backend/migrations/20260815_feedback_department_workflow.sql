ALTER TABLE feedback ADD COLUMN IF NOT EXISTS target_department text;

CREATE TABLE IF NOT EXISTS feedback_views (
  id serial PRIMARY KEY,
  feedback_id integer NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  user_id integer NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feedback_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_views_feedback ON feedback_views (feedback_id);