-- Configurable idle-session timeout. Defaults: 30 minutes idle, warn 1 minute before expiry.
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active_session
  ON refresh_tokens (id, user_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_settings (setting_key, setting_value)
VALUES
  ('idle_timeout_minutes', '30'::jsonb),
  ('idle_warning_minutes', '1'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
