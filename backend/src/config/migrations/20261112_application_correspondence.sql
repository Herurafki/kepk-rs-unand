BEGIN;

CREATE TABLE IF NOT EXISTS application_correspondence (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  incoming_letter_number VARCHAR(150) NOT NULL,
  incoming_letter_subject TEXT NOT NULL,
  signatory_position VARCHAR(255) NOT NULL,
  recipient_institution VARCHAR(255),
  incoming_letter_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
