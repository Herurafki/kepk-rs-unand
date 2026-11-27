-- Normalize application types used by the current KEPK flow.
-- DATA_AWAL: initial data collection request.
-- IZIN_PENELITIAN: research permit request.
-- IZIN_ETIK: ethics permit request.

ALTER TABLE applications
  ALTER COLUMN application_type TYPE VARCHAR(50)
  USING application_type::text;

ALTER TABLE applications
  ALTER COLUMN application_type SET DEFAULT 'IZIN_PENELITIAN';

ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS chk_application_type;

ALTER TABLE applications
  ADD CONSTRAINT chk_application_type
  CHECK (application_type IN ('DATA_AWAL', 'IZIN_PENELITIAN', 'IZIN_ETIK'));

ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS chk_review_type;

ALTER TABLE applications
  ADD CONSTRAINT chk_review_type
  CHECK (
    review_type IS NULL
    OR review_type IN ('EXEMPTED', 'EXPEDITED', 'FULLBOARD')
  );
