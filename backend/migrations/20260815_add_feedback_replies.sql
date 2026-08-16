CREATE TABLE IF NOT EXISTS feedback_replies (
    id SERIAL PRIMARY KEY,
    feedback_id INTEGER NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    user_id INTEGER,
    user_name VARCHAR(100) NOT NULL,
    user_role VARCHAR(30),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_replies_feedback_id ON feedback_replies (feedback_id, created_at);

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS giver_seen_at TIMESTAMPTZ;