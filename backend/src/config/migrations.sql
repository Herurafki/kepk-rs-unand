-- DEPRECATED: this file previously described an obsolete UUID-based schema.
-- The KEPK backend now uses BIGINT/BIGSERIAL IDs and the canonical schema in schema.sql.
-- Do not execute this legacy file. Use "npm run db:setup" for a fresh database or
-- "npm run migrate" for an existing database after setting DB_NAME and DB_SCHEMA.
DO $$
BEGIN
  RAISE EXCEPTION 'src/config/migrations.sql is obsolete. Use src/config/schema.sql and the migration runner.';
END $$;
