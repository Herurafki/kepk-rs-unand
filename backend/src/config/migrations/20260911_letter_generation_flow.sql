BEGIN;

ALTER TABLE letters

  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS letter_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS generated_file_path TEXT;


-- Existing letters were already issued before the generate/sign/upload workflow.
UPDATE letters
   SET letter_status = 'SIGNED_UPLOADED'
 WHERE letter_status IS NULL;

ALTER TABLE letters
  ALTER COLUMN letter_status SET DEFAULT 'GENERATED',
  ALTER COLUMN letter_status SET NOT NULL;

ALTER TABLE letters
  DROP CONSTRAINT IF EXISTS letters_letter_status_check;

ALTER TABLE letters
  ADD CONSTRAINT letters_letter_status_check
  CHECK (letter_status IN ('GENERATED', 'SIGNED_UPLOADED'));

COMMIT;
