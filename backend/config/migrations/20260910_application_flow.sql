BEGIN;

-- ============================================================
-- Application flow
-- DATA_AWAL -> IZIN_PENELITIAN -> IZIN_ETIK
-- Existing application data is preserved.
-- IMPORTANT: all application IDs in this project are BIGINT/INT8.
-- ============================================================

-- 1. Normalize application_type.
-- The existing project may already have application_type_enum with
-- legacy values. Rebuild it only when that enum exists.
DO $$
DECLARE
  current_type text;
BEGIN
  SELECT udt_name
    INTO current_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'applications'
    AND column_name = 'application_type';

  IF current_type = 'application_type_enum' THEN
    ALTER TYPE application_type_enum RENAME TO application_type_enum_old;

    CREATE TYPE application_type_enum AS ENUM (
      'DATA_AWAL',
      'IZIN_PENELITIAN',
      'IZIN_ETIK'
    );

    ALTER TABLE applications
      ALTER COLUMN application_type DROP DEFAULT;

    ALTER TABLE applications
      ALTER COLUMN application_type TYPE application_type_enum
      USING (
        CASE application_type::text
          WHEN 'IZIN_PENELITIAN_ETIK' THEN 'IZIN_ETIK'
          WHEN 'IZIN_PENGAMBILAN_DATA' THEN 'DATA_AWAL'
          ELSE application_type::text
        END
      )::application_type_enum;

    DROP TYPE application_type_enum_old;
  ELSE
    ALTER TABLE applications
      ALTER COLUMN application_type TYPE VARCHAR(50)
      USING application_type::text;

    UPDATE applications
    SET application_type = CASE application_type
      WHEN 'IZIN_PENELITIAN_ETIK' THEN 'IZIN_ETIK'
      WHEN 'IZIN_PENGAMBILAN_DATA' THEN 'DATA_AWAL'
      ELSE application_type
    END;

    ALTER TABLE applications
      DROP CONSTRAINT IF EXISTS chk_application_type;

    ALTER TABLE applications
      ADD CONSTRAINT chk_application_type
      CHECK (application_type IN ('DATA_AWAL', 'IZIN_PENELITIAN', 'IZIN_ETIK'));
  END IF;
END $$;

-- 2. Link an ethics application to its originating research-permit application.
-- applications.id is BIGINT/INT8, therefore the FK must also be BIGINT.
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS parent_application_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_applications_parent_application'
      AND conrelid = 'applications'::regclass
  ) THEN
    ALTER TABLE applications
      ADD CONSTRAINT fk_applications_parent_application
      FOREIGN KEY (parent_application_id)
      REFERENCES applications(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_applications_parent_application_id
  ON applications(parent_application_id);

-- 3. Generic screening storage.
-- application_screenings.application_id is already expected to reference
-- applications.id (BIGINT/INT8). Existing q1-q6 data is copied into JSONB.
ALTER TABLE application_screenings
  ADD COLUMN IF NOT EXISTS screening_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS answers JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'application_screenings'
      AND column_name = 'is_q1'
  ) THEN
    UPDATE application_screenings
    SET answers = COALESCE(
      answers,
      jsonb_build_object(
        'q1', is_q1,
        'q2', is_q2,
        'q3', is_q3,
        'q4', is_q4,
        'q5', is_q5,
        'q6', is_q6
      )
    );
  END IF;
END $$;

UPDATE application_screenings
SET screening_type = COALESCE(screening_type, 'RESEARCH'),
    answers = COALESCE(answers, '{}'::jsonb);

ALTER TABLE application_screenings
  ALTER COLUMN screening_type SET NOT NULL,
  ALTER COLUMN screening_type SET DEFAULT 'RESEARCH',
  ALTER COLUMN answers SET NOT NULL,
  ALTER COLUMN answers SET DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_screening_type'
      AND conrelid = 'application_screenings'::regclass
  ) THEN
    ALTER TABLE application_screenings
      ADD CONSTRAINT chk_screening_type
      CHECK (screening_type IN ('RESEARCH', 'ETHICS'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_application_screenings_application_id
  ON application_screenings(application_id);

CREATE INDEX IF NOT EXISTS idx_application_screenings_type
  ON application_screenings(screening_type);

COMMIT;
