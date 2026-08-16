CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    user_name VARCHAR(100) NOT NULL,
    user_role VARCHAR(30),
    department VARCHAR(100),
    category VARCHAR(30) NOT NULL DEFAULT 'other',
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    priority VARCHAR(10) NOT NULL DEFAULT 'medium',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback (status);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_is_read ON feedback (is_read);