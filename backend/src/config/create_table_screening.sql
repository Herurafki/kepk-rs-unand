-- =====================
-- Table: application_screenings
-- =====================
CREATE TABLE IF NOT EXISTS application_screenings (
  id                            BIGSERIAL PRIMARY KEY,
  application_id                BIGINT UNIQUE NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  is_q1                         BOOLEAN NOT NULL,
  is_q2                         BOOLEAN NOT NULL,
  is_q3                         BOOLEAN NOT NULL,
  is_q4                         BOOLEAN NOT NULL,
  is_q5                         BOOLEAN NOT NULL,
  is_q6                         BOOLEAN NOT NULL,
  created_at                    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_application_screenings_application_id ON application_screenings(application_id);