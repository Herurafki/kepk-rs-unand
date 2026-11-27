'use strict';

const pool = require('../config/database');
const { success } = require('../utils/response');

const list = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;
    const values = [];
    const filters = [];

    if (req.query.search) {
      values.push(`%${String(req.query.search).slice(0, 100)}%`);
      const index = values.length;
      filters.push(`(
        a.action ILIKE $${index}
        OR a.entity_type ILIKE $${index}
        OR COALESCE(a.path, '') ILIKE $${index}
        OR COALESCE(a.method, '') ILIKE $${index}
        OR CAST(a.entity_id AS TEXT) ILIKE $${index}
        OR CAST(a.user_id AS TEXT) ILIKE $${index}
        OR a.ip_address ILIKE $${index}
        OR u.name ILIKE $${index}
        OR u.email ILIKE $${index}
      )`);
    }

    if (req.query.action) {
      values.push(`%${String(req.query.action).slice(0, 100)}%`);
      filters.push(`(a.action ILIKE $${values.length} OR a.method ILIKE $${values.length})`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const count = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}`,
      values,
    );
    const rows = await pool.query(
      `SELECT
         a.id, a.user_id, a.user_role_id, a.action, a.entity_type, a.entity_id,
         a.old_data, a.new_data, a.ip_address, a.user_agent, a.created_at,
         a.method, a.path, a.status_code,
         u.name AS user_name,
         u.email AS user_email,
         CASE
           WHEN historical_role.id IS NOT NULL THEN
             jsonb_build_array(jsonb_build_object(
               'name', historical_role.name,
               'user_role_id', historical_membership.id
             ))
           ELSE COALESCE(current_roles.user_roles, '[]'::jsonb)
         END AS user_roles
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN user_roles historical_membership
         ON historical_membership.id = a.user_role_id
       LEFT JOIN roles historical_role
         ON historical_role.id = historical_membership.role_id
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(jsonb_build_object(
           'name', role_current.name,
           'user_role_id', current_membership.id
         ) ORDER BY role_current.name) AS user_roles
         FROM user_roles current_membership
         JOIN roles role_current ON role_current.id = current_membership.role_id
         WHERE current_membership.user_id = a.user_id
       ) current_roles ON TRUE
       ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );

    return success(
      res,
      {
        items: rows.rows,
        pagination: {
          page,
          limit,
          total: count.rows[0].total,
          total_pages: Math.ceil(count.rows[0].total / limit),
        },
      },
      'Audit trail berhasil dimuat.',
    );
  } catch (err) {
    return next(err);
  }
};

module.exports = { list };
