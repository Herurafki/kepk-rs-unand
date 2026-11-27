BEGIN;

ALTER TABLE application_screenings
    ADD COLUMN IF NOT EXISTS recommendation VARCHAR(30);

COMMIT;