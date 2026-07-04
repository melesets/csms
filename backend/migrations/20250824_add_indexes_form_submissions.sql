-- Indexes to speed analytics queries over form_submissions
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_submissions_template_department ON form_submissions (template_department);
CREATE INDEX IF NOT EXISTS idx_form_submissions_template_id ON form_submissions (template_id);
-- Optional: if you frequently filter by submitted_by or submitted_by_department
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_by ON form_submissions (submitted_by);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_by_department ON form_submissions (submitted_by_department);
