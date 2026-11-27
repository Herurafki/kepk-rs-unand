'use strict';
const pool = require('../config/database');

/**
 * Create a status history record (immutable — never updated/deleted).
 */
const create = async ({ application_id, previous_status, new_status, changed_by, note }, client = pool) => {
  const result = await client.query(
    `INSERT INTO application_status_histories
       (application_id, previous_status, new_status, changed_by, note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [application_id, previous_status || null, new_status, changed_by, note || null]
  );
  return result.rows[0];
};

/**
 * Find all history records for an application.
 */
const findByApplicationId = async (applicationId) => {
  const result = await pool.query(
    `SELECT h.*, u.name AS changed_by_name,
            COALESCE((
              SELECT ARRAY_AGG(DISTINCT role.name::text ORDER BY role.name::text)
              FROM user_roles ur
              JOIN roles role ON role.id = ur.role_id
              WHERE ur.user_id = h.changed_by
            ), ARRAY[]::text[]) AS changed_by_roles
     FROM application_status_histories h
     JOIN users u ON u.id = h.changed_by
     WHERE h.application_id = $1
     ORDER BY h.created_at ASC`,
    [applicationId]
  );
  return result.rows;
};

module.exports = { create, findByApplicationId };
