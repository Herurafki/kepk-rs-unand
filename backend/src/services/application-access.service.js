'use strict';
const pool = require('../config/database');

const forbidden = () => {
  const err = new Error('You are not allowed to access this application');
  err.statusCode = 403;
  return err;
};

const assertApplicationAccess = async (application, userId, roles = []) => {
  if (!application) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }
  if (roles.includes('SUPERADMIN')) return true;
  if (roles.includes('PENELITI')) {
    if (String(application.researcher_user_id) === String(userId)) return true;
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }
  if (roles.includes('DIKLIT')) {
    if (['DATA_AWAL', 'IZIN_PENELITIAN'].includes(application.application_type)) return true;
    throw forbidden();
  }
  if (roles.includes('SEKRETARIAT') || roles.includes('KETUA')) {
    if (application.application_type === 'IZIN_ETIK') return true;
    throw forbidden();
  }
  if (roles.includes('REVIEWER')) {
    const activeRole = await pool.query(
      `SELECT 1 FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE u.id = $1 AND u.is_active = TRUE AND r.name = 'REVIEWER'
       LIMIT 1`,
      [userId]
    );
    if (!activeRole.rows.length) throw forbidden();
    if (application.review_type === 'FULLBOARD') return true;
    const assignment = await pool.query(
      `SELECT 1 FROM review_assignments
       WHERE application_id = $1 AND reviewer_id = $2
         AND status IN ('PENDING', 'ACCEPTED', 'COMPLETED')
       LIMIT 1`,
      [application.id, userId]
    );
    if (assignment.rows.length) return true;
    throw forbidden();
  }
  throw forbidden();
};

module.exports = { assertApplicationAccess };
