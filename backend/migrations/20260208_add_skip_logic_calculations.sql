-- Add comment to document the new features
COMMENT ON COLUMN form_templates.fields IS 'JSON array of form fields with support for skipLogic and calculation properties';

-- Add index for faster template retrieval
CREATE INDEX IF NOT EXISTS idx_form_templates_active 
ON form_templates(is_active) 
WHERE is_active = true;
