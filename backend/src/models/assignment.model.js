'use strict';
const pool = require('../config/database');

const create = async ({ application_id, reviewer_id, assigned_by }, client = pool) => {
  const result = await client.query(
    `INSERT INTO review_assignments (application_id, reviewer_id, assigned_by)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [application_id, reviewer_id, assigned_by]
  );
  return result.rows[0];
};

const findById = async (id, client = pool) => {
  const result = await client.query(
    'SELECT * FROM review_assignments WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

const findByApplicationId = async (applicationId, client = pool) => {
  const result = await client.query(
    `SELECT ra.*, u.name AS reviewer_name, u.email AS reviewer_email
     FROM review_assignments ra
     JOIN users u ON u.id = ra.reviewer_id
     WHERE ra.application_id = $1
     ORDER BY ra.assigned_at ASC`,
    [applicationId]
  );
  return result.rows;
};

const findByReviewerId = async (reviewerId) => {
  const result = await pool.query(
    `SELECT ra.*, a.application_number, a.application_type, a.research_title,
            a.review_type, a.status AS application_status,
            researcher_user.name AS researcher_name
     FROM review_assignments ra
     JOIN applications a ON a.id = ra.application_id
     JOIN researchers researcher ON researcher.id = a.researcher_id
     JOIN users researcher_user ON researcher_user.id = researcher.user_id
     WHERE ra.reviewer_id = $1
       AND a.review_type::text IS DISTINCT FROM 'EXEMPTED'
     ORDER BY ra.assigned_at DESC`,
    [reviewerId]
  );
  return result.rows;
};

const findActiveByApplicationAndReviewer = async (applicationId, reviewerId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM review_assignments
     WHERE application_id = $1 AND reviewer_id = $2
     AND status IN ('PENDING', 'ACCEPTED')`,
    [applicationId, reviewerId]
  );
  return result.rows[0] || null;
};

const accept = async (id, client = pool) => {
  const result = await client.query(
    `UPDATE review_assignments
     SET status = 'ACCEPTED', accepted_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
};

const reject = async (id, client = pool) => {
  const result = await client.query(
    `UPDATE review_assignments
     SET status = 'REJECTED', rejected_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
};

const markCompleted = async (id, client = pool) => {
  await client.query(
    `UPDATE review_assignments SET status = 'COMPLETED' WHERE id = $1`,
    [id]
  );
};

/**
 * Count assignments by status for an application.
 */
const countByStatus = async (applicationId, status, client = pool) => {
  const result = await client.query(
    `SELECT COUNT(*) AS cnt FROM review_assignments
     WHERE application_id = $1 AND status = $2`,
    [applicationId, status]
  );
  return parseInt(result.rows[0].cnt);
};

/**
 * Count all assignments (any status) for an application.
 */
const countTotal = async (applicationId, client = pool) => {
  const result = await client.query(
    `SELECT COUNT(*) AS cnt FROM review_assignments WHERE application_id = $1`,
    [applicationId]
  );
  return parseInt(result.rows[0].cnt);
};

/**
 * Count PENDING assignments for an application.
 */
const countPending = async (applicationId, client = pool) => {
  return countByStatus(applicationId, 'PENDING', client);
};

module.exports = {
  create,
  findById,
  findByApplicationId,
  findByReviewerId,
  findActiveByApplicationAndReviewer,
  accept,
  reject,
  markCompleted,
  countByStatus,
  countTotal,
  countPending,
};
