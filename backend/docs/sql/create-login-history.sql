-- Jalankan pada database/schema aktif KEPK (mis. testing).
CREATE TABLE IF NOT EXISTS login_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255) NULL,
  email VARCHAR(255) NOT NULL,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT')),
  status VARCHAR(10) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
  failure_reason VARCHAR(50) NULL,
  roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  ip_address VARCHAR(50) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON login_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_email ON login_history (email);
CREATE INDEX IF NOT EXISTS idx_login_history_status ON login_history (status);
