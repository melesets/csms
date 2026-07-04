-- Update form_submissions table to include additional metadata
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS template_name VARCHAR(255);
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS template_department VARCHAR(100);
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS submitted_by_name VARCHAR(100);
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS submitted_by_department VARCHAR(100);
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_form_submissions_department ON form_submissions(template_department);
CREATE INDEX IF NOT EXISTS idx_form_submissions_user ON form_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_form_submissions_date ON form_submissions(submitted_at);

-- Update existing records to have template info (if any exist)
UPDATE form_submissions 
SET 
  template_name = t.name,
  template_department = t.department
FROM form_templates t 
WHERE form_submissions.template_id = t.id 
  AND form_submissions.template_name IS NULL;