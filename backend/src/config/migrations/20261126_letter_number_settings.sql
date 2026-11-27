BEGIN;

ALTER TABLE letters ADD COLUMN IF NOT EXISTS registration_number VARCHAR(150);

CREATE TABLE IF NOT EXISTS ethics_registration_counters (
  year INTEGER PRIMARY KEY,
  last_value BIGINT NOT NULL CHECK (last_value >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('letter_number_settings', '{"templates":{"DATA_AWAL":"B/{number}/UN16.34/PT.01.04/{year}","IZIN_PENELITIAN":"B/{number}/UN16.34/PK.01.06/{year}","IZIN_ETIK":"{number}/UN16.34/RSUNAND/{year}","REGISTRASI_ETIK":"B{number}/UN.16.34/KEPK/{month_roman}/{year}"},"registration_start":1}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS uq_letters_registration_number ON letters (registration_number) WHERE registration_number IS NOT NULL;

COMMIT;
