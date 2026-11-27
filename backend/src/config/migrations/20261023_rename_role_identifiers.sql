-- Rename role identifiers without deleting users or changing their permissions.
-- Safe to run repeatedly. Apply only through the migration process.
BEGIN;

DO $$
DECLARE
  role_map RECORD;
  old_role_id roles.id%TYPE;
  new_role_id roles.id%TYPE;
BEGIN
  FOR role_map IN
    SELECT * FROM (VALUES
      ('DIKLAT', 'DIKLIT'),
      ('SEKRETARIS_KEPK', 'SEKRETARIAT'),
      ('CHIEF_KEPK', 'KETUA'),
      ('RESEARCHER', 'PENELITI'),
      ('RESEACHER', 'PENELITI')
    ) AS mappings(old_name, new_name)
  LOOP
    SELECT id INTO old_role_id FROM roles WHERE name = role_map.old_name;
    IF old_role_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT id INTO new_role_id FROM roles WHERE name = role_map.new_name;
    IF new_role_id IS NULL THEN
      UPDATE roles SET name = role_map.new_name WHERE id = old_role_id;
    ELSE
      INSERT INTO user_roles (user_id, role_id)
      SELECT user_id, new_role_id FROM user_roles WHERE role_id = old_role_id
      ON CONFLICT DO NOTHING;

      DELETE FROM user_roles WHERE role_id = old_role_id;
      DELETE FROM roles WHERE id = old_role_id;
    END IF;

    old_role_id := NULL;
    new_role_id := NULL;
  END LOOP;
END $$;

COMMIT;
