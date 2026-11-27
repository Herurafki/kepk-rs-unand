-- Additive migration: keep previous reviewer assessments and identify each round.
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS review_cycle INTEGER;

-- Existing review rows are the first assessment round unless their timestamp
-- belongs to a later resubmission cycle.
UPDATE reviews r
SET review_cycle = COALESCE((
  SELECT COUNT(*)::INTEGER + 1
  FROM final_decisions fd
  WHERE fd.application_id = r.application_id
    AND fd.decision = 'MAJOR_REVISION'
    AND fd.decision_at <= COALESCE(r.reviewed_at, r.created_at)
    AND EXISTS (
      SELECT 1 FROM revisions rv
      WHERE rv.application_id = fd.application_id
        AND rv.submitted_at IS NOT NULL
        AND rv.submitted_at > fd.decision_at
        AND rv.submitted_at <= COALESCE(r.reviewed_at, r.created_at)
    )
), 1)
WHERE r.review_cycle IS NULL;

ALTER TABLE reviews
  ALTER COLUMN review_cycle SET DEFAULT 1;

ALTER TABLE reviews
  ALTER COLUMN review_cycle SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_application_reviewer_cycle
  ON reviews (application_id, reviewer_id, review_cycle DESC, id DESC);
