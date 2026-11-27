'use strict';
const pool = require('../config/database');



const findByApplicationId = async (applicationId, client = pool) => {
  const result = await client.query(
    `SELECT id, application_id, screening_type, answers,recommendation, created_at, updated_at
       FROM application_screenings
      WHERE application_id = $1`,
    [applicationId]
  );
  return result.rows[0] || null;
};

const upsert = async (applicationId, screeningType, answers,recommendation,  client = pool) => {
  const result = await client.query(
    `INSERT INTO application_screenings
       (application_id, screening_type, answers, recommendation)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (application_id)
     DO UPDATE SET
       screening_type = EXCLUDED.screening_type,
       answers = EXCLUDED.answers,
       recommendation = EXCLUDED.recommendation,
       updated_at = NOW()
     RETURNING *`,
    [applicationId, screeningType, JSON.stringify(answers),recommendation,]
  );

  return result.rows[0];
};

const remove = async (applicationId, client = pool) => {
  await client.query(
    'DELETE FROM application_screenings WHERE application_id = $1',
    [applicationId]
  );
};

module.exports = {
  findByApplicationId,
  upsert,
  remove,
};
