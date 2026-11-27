'use strict';
const pool = require('../config/database');

const create = async ({ application_id, requested_by, note }, client = pool) => {
  const countResult = await client.query(
    'SELECT COALESCE(MAX(revision_number), 0) AS max_num FROM revisions WHERE application_id = $1',
    [application_id]
  );
  const nextNumber = parseInt(countResult.rows[0].max_num, 10) + 1;

  const result = await client.query(
    `INSERT INTO revisions (application_id, requested_by, revision_number, note)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [application_id, requested_by, nextNumber, note]
  );
  return result.rows[0];
};

const markSubmitted = async (applicationId, client = pool) => {
  await client.query(
    `UPDATE revisions SET submitted_at = NOW()
     WHERE application_id = $1 AND submitted_at IS NULL`,
    [applicationId]
  );
};

const findOpenRequester = async (applicationId, client = pool) => {
  const result = await client.query(
    `SELECT r.requested_by, u.name AS requested_by_name, u.email AS requested_by_email,
            ARRAY_AGG(DISTINCT role.name) AS requested_by_roles
     FROM revisions r
     JOIN users u ON u.id = r.requested_by
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles role ON role.id = ur.role_id
     WHERE r.application_id = $1
       AND r.submitted_at IS NULL
     GROUP BY r.id, r.requested_by, u.name, u.email
     ORDER BY r.revision_number DESC
     LIMIT 1`,
    [applicationId]
  );
  return result.rows[0] || null;
};

const findByApplicationId = async (applicationId) => {
  const result = await pool.query(
    `SELECT r.*, u.name AS requested_by_name,
            COALESCE((
              SELECT ARRAY_AGG(DISTINCT role.name::text ORDER BY role.name::text)
              FROM user_roles ur
              JOIN roles role ON role.id = ur.role_id
              WHERE ur.user_id = r.requested_by
            ), ARRAY[]::text[]) AS requested_by_roles
     FROM revisions r
     JOIN users u ON u.id = r.requested_by
     WHERE r.application_id = $1
     ORDER BY r.revision_number ASC`,
    [applicationId]
  );
  return result.rows;
};

module.exports = { create, markSubmitted, findOpenRequester, findByApplicationId };
