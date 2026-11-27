BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE, ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
UPDATE users u SET email_verified=TRUE, email_verified_at=COALESCE(u.email_verified_at,u.created_at::timestamptz) WHERE EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name='PENELITI');
CREATE TABLE IF NOT EXISTS email_verification_tokens (id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,token_hash CHAR(64) NOT NULL UNIQUE,expires_at TIMESTAMPTZ NOT NULL,used_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_created ON email_verification_tokens(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expiry ON email_verification_tokens(expires_at) WHERE used_at IS NULL;
COMMIT;
