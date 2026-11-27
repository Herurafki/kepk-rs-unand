-- Bring existing KEPK schemas in line with the current backend contract.
-- Intentionally additive/idempotent; does not delete application or user data.
BEGIN;

DO $body$
BEGIN
  CREATE TYPE application_type_enum AS ENUM ('DATA_AWAL', 'IZIN_PENELITIAN', 'IZIN_ETIK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $body$;

DO $body$
BEGIN
  CREATE TYPE review_type_enum AS ENUM ('EXEMPTED', 'EXPEDITED', 'FULLBOARD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $body$;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS data_collection_date DATE,
  ADD COLUMN IF NOT EXISTS requires_ethics BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS forum_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS forum_closed_at TIMESTAMPTZ;

-- Convert older VARCHAR columns to the enum types used by the current v2 schema.
ALTER TABLE applications DROP CONSTRAINT IF EXISTS chk_application_type;
ALTER TABLE applications DROP CONSTRAINT IF EXISTS chk_review_type;

DO $body$
DECLARE
  app_type_name TEXT;
  review_type_name TEXT;
BEGIN
  SELECT udt_name INTO app_type_name
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'applications'
    AND column_name = 'application_type';

  IF app_type_name IS DISTINCT FROM 'application_type_enum' THEN
    ALTER TABLE applications ALTER COLUMN application_type DROP DEFAULT;
    ALTER TABLE applications
      ALTER COLUMN application_type TYPE application_type_enum
      USING application_type::text::application_type_enum;
  END IF;

  SELECT udt_name INTO review_type_name
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'applications'
    AND column_name = 'review_type';

  IF review_type_name IS DISTINCT FROM 'review_type_enum' THEN
    ALTER TABLE applications ALTER COLUMN review_type DROP DEFAULT;
    ALTER TABLE applications
      ALTER COLUMN review_type TYPE review_type_enum
      USING NULLIF(review_type::text, '')::review_type_enum;
  END IF;
END $body$;

CREATE TABLE IF NOT EXISTS review_assessments (
  id BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
  indicator_answers JSONB NOT NULL,
  indicator_comments JSONB NOT NULL DEFAULT '{}'::jsonb,
  suggestion_information_accuracy TEXT NOT NULL DEFAULT '',
  suggestion_other_ethics TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_review_assessment_answers_object
    CHECK (jsonb_typeof(indicator_answers) = 'object')
);

ALTER TABLE review_assessments
  ADD COLUMN IF NOT EXISTS indicator_comments JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN review_assessments.indicator_comments IS
  'Optional reviewer comments keyed by indicator number 1 through 26';

ALTER TABLE letters
  ADD COLUMN IF NOT EXISTS letter_status VARCHAR(30) NOT NULL DEFAULT 'GENERATED',
  ADD COLUMN IF NOT EXISTS generated_file_path TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE letters DROP CONSTRAINT IF EXISTS chk_letter_type;
ALTER TABLE letters ADD CONSTRAINT chk_letter_type
  CHECK (letter_type IN ('DATA_AWAL','IZIN_PENELITIAN','IZIN_ETIK','BEBAS_KAJI_ETIK'));

ALTER TABLE letters DROP CONSTRAINT IF EXISTS letters_letter_status_check;
ALTER TABLE letters ADD CONSTRAINT letters_letter_status_check
  CHECK (letter_status IN ('GENERATED','SIGNED_UPLOADED'));

ALTER TABLE final_decisions DROP CONSTRAINT IF EXISTS chk_decision;
ALTER TABLE final_decisions ADD CONSTRAINT chk_decision
  CHECK (decision IN ('APPROVED','APPROVED_MINOR','MAJOR_REVISION','REJECTED','NOT_ASSESSABLE','REVISION_REQUIRED'));

CREATE TABLE IF NOT EXISTS application_number_counters (
  year INTEGER PRIMARY KEY,
  last_value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Initialize/update counters from existing application numbers to avoid collisions.
INSERT INTO application_number_counters (year, last_value)
SELECT
  substring(application_number FROM '^APP-([0-9]{4})-[0-9]+
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_unique_ethics_parent
  ON applications(parent_application_id)
  WHERE application_type = 'IZIN_ETIK' AND parent_application_id IS NOT NULL;

INSERT INTO roles (name) VALUES
  ('PENELITI'), ('DIKLIT'), ('SEKRETARIAT'), ('KETUA'), ('REVIEWER'), ('SUPERADMIN')
ON CONFLICT (name) DO NOTHING;

INSERT INTO researchers_categories (name)
SELECT category_name
FROM (VALUES ('mahasiswa'), ('dosen'), ('staff'), ('umum')) AS categories(category_name)
WHERE NOT EXISTS (
  SELECT 1 FROM researchers_categories existing
  WHERE LOWER(existing.name) = category_name
);

COMMIT;
)::INTEGER AS year,
  MAX(substring(application_number FROM '^APP-[0-9]{4}-([0-9]+)
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_unique_ethics_parent
  ON applications(parent_application_id)
  WHERE application_type = 'IZIN_ETIK' AND parent_application_id IS NOT NULL;

INSERT INTO roles (name) VALUES
  ('PENELITI'), ('DIKLIT'), ('SEKRETARIAT'), ('KETUA'), ('REVIEWER'), ('SUPERADMIN')
ON CONFLICT (name) DO NOTHING;

INSERT INTO researchers_categories (name)
SELECT category_name
FROM (VALUES ('mahasiswa'), ('dosen'), ('staff'), ('umum')) AS categories(category_name)
WHERE NOT EXISTS (
  SELECT 1 FROM researchers_categories existing
  WHERE LOWER(existing.name) = category_name
);

COMMIT;
)::BIGINT) AS last_value
FROM applications
WHERE application_number ~ '^APP-[0-9]{4}-[0-9]+
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_unique_ethics_parent
  ON applications(parent_application_id)
  WHERE application_type = 'IZIN_ETIK' AND parent_application_id IS NOT NULL;

INSERT INTO roles (name) VALUES
  ('PENELITI'), ('DIKLIT'), ('SEKRETARIAT'), ('KETUA'), ('REVIEWER'), ('SUPERADMIN')
ON CONFLICT (name) DO NOTHING;

INSERT INTO researchers_categories (name)
SELECT category_name
FROM (VALUES ('mahasiswa'), ('dosen'), ('staff'), ('umum')) AS categories(category_name)
WHERE NOT EXISTS (
  SELECT 1 FROM researchers_categories existing
  WHERE LOWER(existing.name) = category_name
);

COMMIT;

GROUP BY 1
ON CONFLICT (year) DO UPDATE
SET last_value = GREATEST(application_number_counters.last_value, EXCLUDED.last_value),
    updated_at = NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_unique_ethics_parent
  ON applications(parent_application_id)
  WHERE application_type = 'IZIN_ETIK' AND parent_application_id IS NOT NULL;

INSERT INTO roles (name) VALUES
  ('PENELITI'), ('DIKLIT'), ('SEKRETARIAT'), ('KETUA'), ('REVIEWER'), ('SUPERADMIN')
ON CONFLICT (name) DO NOTHING;

INSERT INTO researchers_categories (name)
SELECT category_name
FROM (VALUES ('mahasiswa'), ('dosen'), ('staff'), ('umum')) AS categories(category_name)
WHERE NOT EXISTS (
  SELECT 1 FROM researchers_categories existing
  WHERE LOWER(existing.name) = category_name
);

COMMIT;
