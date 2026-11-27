-- LANGKAH 1: Buat tabel reviewers terlebih dahulu
-- (Sekaligus memperbaiki typo NOW(),1 dari kodemu sebelumnya menjadi NOW())
CREATE TABLE IF NOT EXISTS reviewers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  specialization VARCHAR(255),
  position VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- LANGKAH 2: Migrasi Data - Masukkan user_id yang ada di review_assignments ke tabel reviewers
INSERT INTO reviewers (user_id)
SELECT DISTINCT reviewer_id FROM review_assignments
ON CONFLICT (user_id) DO NOTHING;

-- LANGKAH 3: Lepas ikatan (Constraint/Foreign Key) lama
ALTER TABLE review_assignments DROP CONSTRAINT IF EXISTS review_assignments_reviewer_id_fkey;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_reviewer_id_fkey;

-- LANGKAH 4: Update UUID di tabel lama agar sesuai dengan UUID di tabel reviewers yang baru
UPDATE review_assignments ra
SET reviewer_id = r.id
FROM reviewers r
WHERE ra.reviewer_id = r.user_id;

UPDATE reviews rv
SET reviewer_id = r.id
FROM reviewers r
WHERE rv.reviewer_id = r.user_id;

-- LANGKAH 5: Kunci kembali relasi (Foreign Key) yang baru
ALTER TABLE review_assignments DROP CONSTRAINT IF EXISTS fk_assignment_reviewer;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS fk_review_reviewer;

-- Tambahkan constraint
ALTER TABLE review_assignments
  ADD CONSTRAINT fk_assignment_reviewer 
  FOREIGN KEY (reviewer_id) REFERENCES reviewers(id) ON DELETE CASCADE;

ALTER TABLE reviews
  ADD CONSTRAINT fk_review_reviewer 
  FOREIGN KEY (reviewer_id) REFERENCES reviewers(id) ON DELETE CASCADE;

--===============
-- Menambah kolom profil ke tabel researchers
--===============

-- ALTER TABLE researchers
-- ADD COLUMN IF NOT EXISTS 
--   nim VARCHAR(50)
-- ,
-- ADD COLUMN IF NOT EXISTS 
--   nik VARCHAR(50)
-- ,
-- ADD COLUMN IF NOT EXISTS
--   department varchar(255)
-- ;