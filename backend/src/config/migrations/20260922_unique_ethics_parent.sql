BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_unique_ethics_parent
ON applications (parent_application_id)
WHERE application_type = 'IZIN_ETIK'
  AND parent_application_id IS NOT NULL;

COMMIT;