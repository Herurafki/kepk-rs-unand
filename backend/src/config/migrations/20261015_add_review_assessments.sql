-- Migration: add structured reviewer assessment (26 yes/no indicators + 2 suggestions)
-- Compatible with existing databases and existing review rows.
-- Run against the same schema/search_path used by the KEPK API.

BEGIN;

CREATE TABLE IF NOT EXISTS review_assessments (
  id BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
  indicator_answers JSONB NOT NULL,
  suggestion_information_accuracy TEXT NOT NULL DEFAULT '',
  suggestion_other_ethics TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_review_assessment_answers_object
    CHECK (jsonb_typeof(indicator_answers) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_review_assessments_review_id
  ON review_assessments(review_id);

COMMIT;
