BEGIN;

UPDATE applications
SET research_objectives = purpose
WHERE purpose IS NOT NULL
  AND TRIM(purpose) <> '';

-- Cek hasilnya dulu
SELECT
    id,
    research_objectives,
    purpose
FROM applications
ORDER BY id;

ALTER TABLE applications
DROP COLUMN purpose;

COMMIT;