-- Form Submissions Table for dynamic form records
CREATE TABLE IF NOT EXISTS form_submissions (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  submitted_by VARCHAR(100),
  submitted_at TIMESTAMP DEFAULT NOW()
);
