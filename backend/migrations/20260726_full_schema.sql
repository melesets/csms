-- =============================================================
-- ISBAR Full Schema — Fresh Database Migration
-- Generated: 2026-07-26
-- Run this single file on an empty PostgreSQL database.
-- =============================================================

-- ── 1. USERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    department VARCHAR(100),
    profession VARCHAR(100),
    isActive BOOLEAN DEFAULT TRUE,
    permissions JSONB,
    profile_picture VARCHAR(255),
    pin_hash VARCHAR(255),
    has_pin BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(100),
    shift_type VARCHAR(10) DEFAULT 'TID',
    active_shift_id INTEGER,
    parent_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_parent_user_id ON users(parent_user_id);

-- ── 2. DEPARTMENT STAFF ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS department_staff (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    department VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_department_staff_department ON department_staff(department);

-- ── 3. FORM TEMPLATES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    description TEXT,
    fields JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    sections JSONB,
    version INTEGER DEFAULT 1,
    created_by VARCHAR(100),
    departments TEXT[],
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_templates_active ON form_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_form_templates_departments_gin ON form_templates USING GIN (departments);

-- ── 4. FORM SUBMISSIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_submissions (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES form_templates(id),
    form_data JSONB,
    template_name VARCHAR(255),
    template_department VARCHAR(100),
    submitted_by VARCHAR(100),
    submitted_by_name VARCHAR(100),
    submitted_by_department VARCHAR(100),
    submitted_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_template_id ON form_submissions(template_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_submissions_department ON form_submissions(template_department);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_by ON form_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_by_department ON form_submissions(submitted_by_department);

-- ── 5. RESOURCES ────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_resources_department ON resources(department);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);

-- ── 6. FORMS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    schema JSONB NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 7. ISBAR RECORDS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS isbar_records (
    id SERIAL PRIMARY KEY,
    department VARCHAR(100),
    form_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ── 8. INVENTORY REPORTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_reports (
    id SERIAL PRIMARY KEY,
    shift VARCHAR(16) NOT NULL CHECK (shift IN ('Morning', 'Evening', 'Night')),
    staffName VARCHAR(100) NOT NULL,
    staffId INTEGER NOT NULL,
    department VARCHAR(100) NOT NULL,
    date TIMESTAMP NOT NULL,
    resources JSONB NOT NULL,
    co_signers JSONB DEFAULT '[]',
    shift_session_id INTEGER
);

-- ── 9. ADMIN ACTIVITY LOG ───────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    module VARCHAR(50) NOT NULL,
    target_id VARCHAR(255),
    detail TEXT,
    performed_by VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at ON admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_performed_by ON admin_activity_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_module ON admin_activity_log(module);

-- ── 10. ADMIN SETTINGS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ── 11. DASHBOARD MAPPINGS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS dashboard_mappings (
    id SERIAL PRIMARY KEY,
    form_template_id INTEGER REFERENCES form_templates(id) ON DELETE CASCADE,
    form_template_name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    departments TEXT[],
    profession VARCHAR(50),
    dashboard_type VARCHAR(20) NOT NULL CHECK (dashboard_type IN ('patient', 'resource')),
    display_name VARCHAR(255) NOT NULL,
    identifier VARCHAR(100),
    card_fields JSONB NOT NULL DEFAULT '{}',
    group_by_field VARCHAR(100),
    is_enabled BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ── 12. INTEGRATION CONFIGS ─────────────────────────────────
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

-- ── 13. SHIFT TYPES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    abbreviation VARCHAR(10) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
    default_hours NUMERIC(4,1) NOT NULL DEFAULT 8,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    department VARCHAR(100),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_types_unique_name_dept ON shift_types(name, COALESCE(department, ''));

-- ── 14. SCHEDULES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    staff_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shift_type_id INTEGER NOT NULL REFERENCES shift_types(id) ON DELETE RESTRICT,
    schedule_date DATE NOT NULL,
    department VARCHAR(100) NOT NULL,
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(staff_user_id, schedule_date, department)
);

CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedules_dept_date ON schedules(department, schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedules_staff ON schedules(staff_user_id);

-- ── 15. SCHEDULE CHANGE LOG ─────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_change_log (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
    staff_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shift_type_id INTEGER REFERENCES shift_types(id) ON DELETE SET NULL,
    schedule_date DATE NOT NULL,
    department VARCHAR(100) NOT NULL,
    action VARCHAR(20) NOT NULL,
    old_shift_type_id INTEGER REFERENCES shift_types(id) ON DELETE SET NULL,
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_change_log_date ON schedule_change_log(schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedule_change_log_staff ON schedule_change_log(staff_user_id);

-- ── 16. STAFF UNAVAILABILITY ────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_unavailability (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    reason VARCHAR(255),
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_date_range CHECK (date_to >= date_from)
);

CREATE INDEX IF NOT EXISTS idx_staff_unavailability_user ON staff_unavailability(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_unavailability_dates ON staff_unavailability(date_from, date_to);

-- ── 17. MINIMUM STAFFING ────────────────────────────────────
CREATE TABLE IF NOT EXISTS minimum_staffing (
    id SERIAL PRIMARY KEY,
    shift_type_id INTEGER NOT NULL REFERENCES shift_types(id) ON DELETE CASCADE,
    department VARCHAR(100) NOT NULL,
    min_staff_count INTEGER NOT NULL DEFAULT 1,
    day_of_week INTEGER,
    is_holiday BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(shift_type_id, department, day_of_week, is_holiday)
);

-- ── 18. SHIFT SESSIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(100),
    profession VARCHAR(100),
    ward VARCHAR(100),
    shift_name VARCHAR(50),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- ── 19. CLINICAL HANDOVERS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS clinical_handovers (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ward VARCHAR(100),
    profession VARCHAR(100),
    shift_name VARCHAR(50),
    handover_data JSONB,
    mrn VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ── 20. SERVICE UNITS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_units (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    department VARCHAR(100),
    pin_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE
);

-- ── 21. SHIFT WINDOWS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_windows (
    id SERIAL PRIMARY KEY,
    unit_id INTEGER REFERENCES service_units(id) ON DELETE CASCADE,
    shift_name VARCHAR(50) NOT NULL,
    start_hour INTEGER NOT NULL DEFAULT 0,
    end_hour INTEGER NOT NULL DEFAULT 24,
    handover_window_minutes INTEGER DEFAULT 30
);

-- ── 22. STAFF PINS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_pins (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    unit_id INTEGER REFERENCES service_units(id) ON DELETE CASCADE,
    pin_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (user_id, unit_id)
);

-- ── 23. UNIT SESSIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS unit_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    unit_id INTEGER REFERENCES service_units(id) ON DELETE SET NULL,
    shift_name VARCHAR(50),
    checked_in TIMESTAMP,
    checked_out TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- ── 24. MIGRATIONS TRACKING ─────────────────────────────────
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    filename TEXT UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── DEFAULT DATA ────────────────────────────────────────────

-- Default shift types
INSERT INTO shift_types (name, abbreviation, color, default_hours, sort_order) VALUES
    ('Day',       'DAY', '#10b981', 8, 1),
    ('Evening',   'EVE', '#f59e0b', 8, 2),
    ('Night',     'NGT', '#1e1b4b', 8, 3),
    ('Off',       'OFF', '#6b7280', 0, 4),
    ('On-Call',   'ONC', '#3b82f6', 8, 5),
    ('Leave',     'LVE', '#ef4444', 0, 6)
ON CONFLICT DO NOTHING;

-- Superadmin default account (password: superadmin123 — change on first login)
INSERT INTO users (username, password, name, email, role, department, isactive)
VALUES (
    'superadmin',
    '$2b$10$bKrwDDh/8uBd8KwpB9fpJ.13nTOtLWdnu.gkQ/EtRPYvGiQcBz7j6',
    'Super Administrator',
    'superadmin@isbar.local',
    'superadmin',
    'System',
    TRUE
) ON CONFLICT (username) DO NOTHING;
