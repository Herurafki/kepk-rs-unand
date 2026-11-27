BEGIN;

ALTER TABLE v2.letters
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS letter_status VARCHAR(30);

UPDATE v2.letters
   SET letter_status = 'SIGNED_UPLOADED'
 WHERE letter_status IS NULL;

ALTER TABLE v2.letters
  ALTER COLUMN letter_status SET DEFAULT 'GENERATED',
  ALTER COLUMN letter_status SET NOT NULL;

ALTER TABLE v2.letters
  DROP CONSTRAINT IF EXISTS letters_letter_status_check,
  ADD CONSTRAINT letters_letter_status_check
    CHECK (letter_status IN ('GENERATED', 'SIGNED_UPLOADED'));

COMMIT;
