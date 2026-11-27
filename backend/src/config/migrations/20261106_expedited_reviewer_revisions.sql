-- Expedited reviewer-driven revision cycles and immutable review rounds.
BEGIN;
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS review_cycle INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS expedited_reviewer_states (
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  reviewer_id BIGINT NOT NULL REFERENCES users(id),
  state VARCHAR(24) NOT NULL DEFAULT 'WAITING',
  last_review_id BIGINT REFERENCES reviews(id),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (application_id, reviewer_id),
  CONSTRAINT chk_expedited_reviewer_state
    CHECK (state IN ('WAITING', 'NEEDS_REVISION', 'IN_REVIEW', 'FINAL'))
);

CREATE TABLE IF NOT EXISTS expedited_revision_requests (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  reviewer_id BIGINT NOT NULL REFERENCES users(id),
  review_id BIGINT NOT NULL REFERENCES reviews(id),
  cycle_number INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMP,
  CONSTRAINT chk_expedited_revision_request_status
    CHECK (status IN ('OPEN', 'SUBMITTED'))
);

CREATE TABLE IF NOT EXISTS expedited_revision_items (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES expedited_revision_requests(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES documents(id),
  note TEXT NOT NULL,
  revised_document_id BIGINT REFERENCES documents(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  revised_at TIMESTAMP,
  UNIQUE (request_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_expedited_revision_requests_app
  ON expedited_revision_requests(application_id, status);
CREATE INDEX IF NOT EXISTS idx_expedited_revision_items_request
  ON expedited_revision_items(request_id);

COMMIT;
