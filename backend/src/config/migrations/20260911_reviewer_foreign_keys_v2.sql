-- The backend stores authenticated users' IDs in reviewer_id.
-- Keep the v2 schema constraints aligned with that API contract.
ALTER TABLE v2.review_assignments
  DROP CONSTRAINT IF EXISTS fk_assignment_reviewer,
  ADD CONSTRAINT fk_assignment_reviewer
    FOREIGN KEY (reviewer_id) REFERENCES v2.users(id) ON DELETE CASCADE;

ALTER TABLE v2.reviews
  DROP CONSTRAINT IF EXISTS fk_review_reviewer,
  ADD CONSTRAINT fk_review_reviewer
    FOREIGN KEY (reviewer_id) REFERENCES v2.users(id) ON DELETE CASCADE;
