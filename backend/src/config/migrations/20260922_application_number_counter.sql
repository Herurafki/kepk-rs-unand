BEGIN;

CREATE TABLE IF NOT EXISTS application_number_counters (
    year INTEGER PRIMARY KEY,
    last_value BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO application_number_counters (year, last_value)
SELECT
    substring(application_number FROM '^APP-([0-9]{4})-[0-9]+$')::INTEGER AS year,
    MAX(
        substring(application_number FROM '^APP-[0-9]{4}-([0-9]+)$')::BIGINT
    ) AS last_value
FROM applications
WHERE application_number ~ '^APP-[0-9]{4}-[0-9]+$'
GROUP BY 1
ON CONFLICT (year)
DO UPDATE SET
    last_value = GREATEST(
        application_number_counters.last_value,
        EXCLUDED.last_value
    ),
    updated_at = NOW();

COMMIT;