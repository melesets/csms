-- Create department_staff table
CREATE TABLE IF NOT EXISTS department_staff (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    department VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create resources table
CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('Drug', 'Equipment')),
    quantity INTEGER NOT NULL DEFAULT 0,
    standard_quantity INTEGER NOT NULL DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    expiry_date DATE,
    batch_number VARCHAR(50),
    department VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Update users table to include missing columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS isActive BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB;

-- Update form_templates table to include missing columns
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS sections JSONB;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);

-- Update form_submissions table to match expected structure
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES form_templates(id);
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS form_data JSONB;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS submitted_by VARCHAR(100);
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP DEFAULT NOW();

-- Drop the old form_id column if it exists and conflicts
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'form_submissions' AND column_name = 'form_id') THEN
        ALTER TABLE form_submissions DROP COLUMN form_id;
    END IF;
END $$;

-- Rename data column to form_data if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'form_submissions' AND column_name = 'data') THEN
        ALTER TABLE form_submissions RENAME COLUMN data TO form_data;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_department_staff_department ON department_staff(department);
CREATE INDEX IF NOT EXISTS idx_resources_department ON resources(department);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);
CREATE INDEX IF NOT EXISTS idx_form_submissions_template_id ON form_submissions(template_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);