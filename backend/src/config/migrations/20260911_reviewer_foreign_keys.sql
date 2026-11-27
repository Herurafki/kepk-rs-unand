-- The API passes authenticated users' IDs as reviewer_id. Keep the database
-- constraints aligned with that contract for assignments and submitted reviews.
ALTER TABLE review_assignments
  DROP CONSTRAINT IF EXISTS fk_assignment_reviewer,
  ADD CONSTRAINT fk_assignment_reviewer
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS fk_review_reviewer,
  ADD CONSTRAINT fk_review_reviewer
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE;
