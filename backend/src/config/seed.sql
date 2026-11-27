-- KEPK Seed Data
-- Initial roles

INSERT INTO roles (name) VALUES
  ('PENELITI'),
  ('DIKLIT'),
  ('SEKRETARIAT'),
  ('KETUA'),
  ('REVIEWER'),
  ('SUPERADMIN')
ON CONFLICT (name) DO NOTHING;
