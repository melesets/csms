-- Integration configs table - stores external system connection settings
CREATE TABLE IF NOT EXISTS integration_configs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'rest',
  base_url TEXT,
  auth_type VARCHAR(50) DEFAULT 'none',
  auth_config JSONB DEFAULT '{}'::jsonb,
  field_mappings JSONB DEFAULT '[]'::jsonb,
  sync_settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMP,
  last_sync_status VARCHAR(20),
  last_sync_message TEXT,
  created_by VARCHAR(100) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_configs_type ON integration_configs(type);
CREATE INDEX IF NOT EXISTS idx_integration_configs_active ON integration_configs(is_active);
