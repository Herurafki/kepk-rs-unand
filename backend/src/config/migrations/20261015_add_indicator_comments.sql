BEGIN;

ALTER TABLE review_assessments
  ADD COLUMN IF NOT EXISTS indicator_comments JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN review_assessments.indicator_comments IS
  'Optional reviewer comments keyed by indicator number 1 through 26';

COMMIT;
