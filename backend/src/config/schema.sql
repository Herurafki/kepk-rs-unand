-- KEPK canonical PostgreSQL schema.
-- Matches the v2 database structure and the current backend workflows.
-- Set DB_SCHEMA (for example: v2) as the connection search_path before applying.
-- Safe for repeat application: CREATE TABLE/INDEX and seeds are idempotent.
-- Existing rows are never deleted by this file.

DO $$
BEGIN
  CREATE TYPE application_type_enum AS ENUM ('DATA_AWAL', 'IZIN_PENELITIAN', 'IZIN_ETIK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE review_type_enum AS ENUM ('EXEMPTED', 'EXPEDITED', 'FULLBOARD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS researchers_categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(225)
);

CREATE TABLE IF NOT EXISTS researchers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  institution VARCHAR(255),
  faculty VARCHAR(255),
  phone VARCHAR(50),
  program_study VARCHAR(255),
  address TEXT,
  nip VARCHAR(100),
  nim VARCHAR(50),
  nik VARCHAR(100),
  department VARCHAR(255),
  category_id BIGINT REFERENCES researchers_categories(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_created ON email_verification_tokens(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_created
  ON password_reset_tokens (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry
  ON password_reset_tokens (expires_at) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS application_number_counters (
  year INTEGER PRIMARY KEY,
  last_value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id BIGSERIAL PRIMARY KEY,
  researcher_id BIGINT NOT NULL REFERENCES researchers(id),
  application_number VARCHAR(100) NOT NULL UNIQUE,
  application_type application_type_enum NOT NULL,
  group_category VARCHAR(50) NOT NULL,
  research_title VARCHAR(500) NOT NULL,
  research_background TEXT,
  research_objectives TEXT,
  research_methodology TEXT,
  research_location VARCHAR(255),
  research_institution VARCHAR(255),
  research_duration VARCHAR(100),
  data_collection_date DATE,
  data_needed TEXT,
  purpose TEXT,
  person_responsible VARCHAR(255),
  parent_application_id BIGINT REFERENCES applications(id) ON DELETE SET NULL,
  review_type review_type_enum,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  forum_date TIMESTAMP,
  forum_closed_at TIMESTAMPTZ,
  requires_ethics BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_group_category CHECK (group_category IN ('Mahasiswa','Dosen','Staff','Umum')),
  CONSTRAINT chk_status CHECK (status IN (
    'DRAFT','SUBMITTED','ADMIN_REVIEW','REVISION_REQUIRED','ADMIN_APPROVED',
    'REQUIRED_ETHICS','SEKRETARIS_REVIEW','WAITING_REVIEWER','UNDER_REVIEW','REVIEW_COMPLETED',
    'APPROVED','REJECTED','NOT_ASSESSABLE','PERMIT_ISSUED'
  ))
);

CREATE TABLE IF NOT EXISTS application_screenings (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  screening_type VARCHAR(30) NOT NULL DEFAULT 'RESEARCH',
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation VARCHAR(30),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_screening_type CHECK (screening_type IN ('RESEARCH','ETHICS'))
);

CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  stored_name VARCHAR(500) NOT NULL,
  file_path TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviewers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id),
  specialization VARCHAR(255),
  position VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_assignments (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id),
  reviewer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by BIGINT NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMP,
  rejected_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  CONSTRAINT chk_assignment_status CHECK (status IN ('PENDING','ACCEPTED','REJECTED','COMPLETED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_assignments_active_unique
  ON review_assignments (application_id, reviewer_id)
  WHERE status IN ('PENDING','ACCEPTED');
CREATE INDEX IF NOT EXISTS idx_review_assignments_application_id ON review_assignments(application_id);
CREATE INDEX IF NOT EXISTS idx_review_assignments_reviewer_id ON review_assignments(reviewer_id);

CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id),
  reviewer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation VARCHAR(20) NOT NULL,
  review_cycle INTEGER NOT NULL DEFAULT 1,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_recommendation CHECK (recommendation IN ('APPROVE','REVISION','REJECT'))
);

CREATE TABLE IF NOT EXISTS review_assessments (
  id BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
  indicator_answers JSONB NOT NULL,
  indicator_comments JSONB NOT NULL DEFAULT '{}'::jsonb,
  suggestion_information_accuracy TEXT NOT NULL DEFAULT '',
  suggestion_other_ethics TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_review_assessment_answers_object CHECK (jsonb_typeof(indicator_answers) = 'object')
);
COMMENT ON COLUMN review_assessments.indicator_comments IS
  'Optional reviewer comments keyed by indicator number 1 through 26';

CREATE TABLE IF NOT EXISTS review_comments (
  id BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS application_status_histories (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id),
  previous_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  changed_by BIGINT NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revisions (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id),
  requested_by BIGINT NOT NULL REFERENCES users(id),
  revision_number INTEGER NOT NULL,
  note TEXT NOT NULL,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS final_decisions (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id),
  decided_by_user_role_id BIGINT NOT NULL REFERENCES user_roles(id),
  decision VARCHAR(30) NOT NULL,
  comments TEXT,
  decision_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_decision CHECK (decision IN (
    'APPROVED','APPROVED_MINOR','MAJOR_REVISION','REJECTED','NOT_ASSESSABLE','REVISION_REQUIRED'
  ))
);

CREATE TABLE IF NOT EXISTS letters (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL UNIQUE REFERENCES applications(id),
  letter_number VARCHAR(100) NOT NULL UNIQUE,
  letter_type VARCHAR(30) NOT NULL,
  file_path TEXT,
  issued_by_user_role_id BIGINT NOT NULL REFERENCES user_roles(id),
  issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  letter_status VARCHAR(30) NOT NULL DEFAULT 'GENERATED',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  generated_file_path TEXT,
  CONSTRAINT chk_letter_type CHECK (letter_type IN (
    'DATA_AWAL','IZIN_PENELITIAN','IZIN_ETIK','BEBAS_KAJI_ETIK'
  )),
  CONSTRAINT letters_letter_status_check CHECK (letter_status IN ('GENERATED','SIGNED_UPLOADED'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  user_role_id BIGINT REFERENCES user_roles(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT,
  old_data JSONB,
  new_data JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_researchers_category_id ON researchers(category_id);
CREATE INDEX IF NOT EXISTS idx_application_screenings_type ON application_screenings(screening_type);
CREATE INDEX IF NOT EXISTS idx_application_status_histories_application_id ON application_status_histories(application_id);
CREATE INDEX IF NOT EXISTS idx_applications_researcher_id ON applications(researcher_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_parent_application_id ON applications(parent_application_id);
CREATE INDEX IF NOT EXISTS idx_documents_application_id ON documents(application_id);
CREATE INDEX IF NOT EXISTS idx_reviews_application_id ON reviews(application_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_review_assessments_review_id ON review_assessments(review_id);
CREATE INDEX IF NOT EXISTS idx_revisions_application_id ON revisions(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_unique_ethics_parent
  ON applications(parent_application_id)
  WHERE application_type = 'IZIN_ETIK' AND parent_application_id IS NOT NULL;

INSERT INTO roles (name) VALUES
  ('PENELITI'), ('DIKLIT'), ('SEKRETARIAT'), ('KETUA'), ('REVIEWER'), ('SUPERADMIN')
ON CONFLICT (name) DO NOTHING;

INSERT INTO researchers_categories (name)
SELECT category_name
FROM (VALUES ('mahasiswa'), ('dosen'), ('staff'), ('umum')) AS categories(category_name)
WHERE NOT EXISTS (
  SELECT 1 FROM researchers_categories existing
  WHERE LOWER(existing.name) = category_name
);
