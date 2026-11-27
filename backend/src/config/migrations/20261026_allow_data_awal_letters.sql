-- Allow DIKLIT to generate letters for DATA_AWAL on existing databases.
-- Safe and idempotent: only replaces the check constraint; no application data is changed.
BEGIN;

ALTER TABLE letters DROP CONSTRAINT IF EXISTS chk_letter_type;
ALTER TABLE letters ADD CONSTRAINT chk_letter_type
  CHECK (letter_type IN ('DATA_AWAL', 'IZIN_PENELITIAN', 'IZIN_ETIK', 'BEBAS_KAJI_ETIK'));

COMMIT;
