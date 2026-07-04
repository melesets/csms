-- Add departments array column for multi-department templates
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS departments TEXT[];

-- Backfill existing rows to keep behavior consistent
UPDATE form_templates
SET departments = ARRAY[department]
WHERE departments IS NULL AND department IS NOT NULL;

-- Helpful index for ANY() queries on departments
CREATE INDEX IF NOT EXISTS idx_form_templates_departments_gin ON form_templates USING GIN (departments);
