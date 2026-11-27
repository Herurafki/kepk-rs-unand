BEGIN;

-- Tambahkan informasi identitas pengguna
ALTER TABLE testing.audit_logs
    ADD COLUMN IF NOT EXISTS user_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);

-- Snapshot role pengguna saat aktivitas dilakukan
ALTER TABLE testing.audit_logs
    ADD COLUMN IF NOT EXISTS user_roles JSONB
    NOT NULL DEFAULT '[]'::jsonb;

-- Informasi request HTTP
ALTER TABLE testing.audit_logs
    ADD COLUMN IF NOT EXISTS method VARCHAR(10),
    ADD COLUMN IF NOT EXISTS path TEXT,
    ADD COLUMN IF NOT EXISTS status_code INTEGER;

-- Default untuk aktivitas yang tidak memiliki entity spesifik
ALTER TABLE testing.audit_logs
    ALTER COLUMN entity_type SET DEFAULT 'SYSTEM';

-- Index untuk kebutuhan pencarian dan filter
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON testing.audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email
    ON testing.audit_logs (user_email);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_action
    ON testing.audit_logs (created_at DESC, action);

COMMIT;