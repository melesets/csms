-- Admin activity log - tracks destructive/privileged actions for audit trail
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id          SERIAL PRIMARY KEY,
    action      VARCHAR(50)  NOT NULL,
    module      VARCHAR(50)  NOT NULL,
    target_id   VARCHAR(255),
    detail      TEXT,
    performed_by VARCHAR(100) NOT NULL,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at ON admin_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_performed_by ON admin_activity_log (performed_by);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_module       ON admin_activity_log (module);
