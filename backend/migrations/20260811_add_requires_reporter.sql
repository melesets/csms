-- Add requires_reporter column to form_templates
-- Marks a template as requiring a staff reporter (Report page) vs general survey (Survey page)
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS requires_reporter BOOLEAN NOT NULL DEFAULT FALSE;
