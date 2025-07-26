-- Table for ISBAR form templates
CREATE TABLE form_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  department VARCHAR(50) NOT NULL,
  fields JSONB NOT NULL, -- stores the form fields and structure
  is_active BOOLEAN DEFAULT true
);
