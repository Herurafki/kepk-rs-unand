-- Align every numeric `id` sequence with the data already stored.
-- Safe to run repeatedly: the next generated ID becomes MAX(id) + 1.
DO $$
DECLARE
  item RECORD;
  next_id BIGINT;
BEGIN
  FOR item IN
    SELECT cls.oid::regclass AS table_ref,
           pg_get_serial_sequence(format('%I.%I', ns.nspname, cls.relname), 'id') AS sequence_name
    FROM pg_class cls
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    JOIN pg_attribute attr ON attr.attrelid = cls.oid
    WHERE cls.relkind = 'r'
      AND ns.nspname = 'public'
      AND attr.attname = 'id'
      AND attr.atttypid = 'int8'::regtype
      AND NOT attr.attisdropped
  LOOP
    IF item.sequence_name IS NOT NULL THEN
      EXECUTE format('SELECT COALESCE(MAX(id), 0) + 1 FROM %s', item.table_ref)
        INTO next_id;
      PERFORM setval(item.sequence_name::regclass, next_id, false);
    END IF;
  END LOOP;
END $$;
