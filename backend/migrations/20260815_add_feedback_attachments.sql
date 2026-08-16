CREATE TABLE IF NOT EXISTS feedback_attachments (
    id SERIAL PRIMARY KEY,
    feedback_id INTEGER REFERENCES feedback(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_attachments_feedback_id ON feedback_attachments (feedback_id);