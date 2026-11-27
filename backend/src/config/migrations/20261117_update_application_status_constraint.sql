-- Allow the explicit research workflow statuses introduced in November 2026.
-- Keep ADMIN_APPROVED temporarily for compatibility with existing application rows.
BEGIN;

ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS chk_status;

ALTER TABLE applications
  ADD CONSTRAINT chk_status CHECK (status IN (
    'DRAFT',
    'SUBMITTED',
    'ADMIN_REVIEW',
    'REVISION_REQUIRED',
    'ADMIN_APPROVED',
    'REQUIRED_ETHICS',
    'SEKRETARIS_REVIEW',
    'WAITING_REVIEWER',
    'UNDER_REVIEW',
    'REVIEW_COMPLETED',
    'APPROVED',
    'REJECTED',
    'NOT_ASSESSABLE',
    'PERMIT_ISSUED'
  ));

COMMIT;
