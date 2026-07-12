-- Form Templates Table for dynamic forms
CREATE TABLE IF NOT EXISTS form_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  description TEXT,
  fields JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
-- Inventory Reports Table
CREATE TABLE IF NOT EXISTS inventory_reports (
    id SERIAL PRIMARY KEY,
    shift VARCHAR(16) NOT NULL CHECK (shift IN ('Morning', 'Evening', 'Night')),
    staffName VARCHAR(100) NOT NULL,
    staffId INTEGER NOT NULL,
    department VARCHAR(100) NOT NULL,
    date TIMESTAMP NOT NULL,
    resources JSONB NOT NULL,
    co_signers JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    schema JSONB NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reset ISBAR dynamic records table for dynamic form storage only
DROP TABLE IF EXISTS isbar_records;

CREATE TABLE isbar_records (
  id SERIAL PRIMARY KEY,
  department VARCHAR(100),
  form_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- (Optional) Add indexes for department or created_at if you need fast filtering
-- CREATE INDEX idx_isbar_department ON isbar_records(department);
-- CREATE INDEX idx_isbar_created_at ON isbar_records(created_at);
