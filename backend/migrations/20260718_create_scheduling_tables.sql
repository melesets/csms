-- Migration: Create scheduling tables for Staff Scheduling feature
-- Date: 2026-07-18

-- 1. Shift types (configurable per department)
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

-- 2. Schedule assignments (one row per staff per day)
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

-- 3. Schedule change log (audit trail)
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

-- 4. Staff unavailability (leave, personal days, etc.)
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

-- 5. Minimum staffing thresholds per shift type per department
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
