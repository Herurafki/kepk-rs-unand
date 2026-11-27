BEGIN;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS requires_ethics BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_ethics_parent
  ON applications (parent_application_id)
  WHERE application_type = 'IZIN_ETIK';

COMMIT;
