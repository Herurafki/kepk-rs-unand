'use strict';

const pool = require('../config/database');

const TERMINAL_STATUSES = ['PERMIT_ISSUED', 'REJECTED', 'NOT_ASSESSABLE', 'BEBAS_KAJI_ETIK', 'IZIN_ETIK', 'SIGNED_UPLOADED'];
const COMPLETED_STATUSES = ['PERMIT_ISSUED', 'BEBAS_KAJI_ETIK', 'IZIN_ETIK', 'SIGNED_UPLOADED'];
const VALID_TYPES = ['DATA_AWAL', 'IZIN_PENELITIAN', 'IZIN_ETIK'];

const buildFilters = ({ search, status, type, from, to }) => {
  const values = [];
  const clauses = [];
  if (search) {
    values.push(`%${String(search).slice(0, 120)}%`);
    const p = values.length;
    clauses.push(`(
      a.application_number ILIKE $${p}
      OR COALESCE(a.research_title, '') ILIKE $${p}
      OR COALESCE(u.name, '') ILIKE $${p}
      OR COALESCE(u.email, '') ILIKE $${p}
    )`);
  }
  if (status) { values.push(status); clauses.push(`a.status::text = $${values.length}`); }
  if (type && VALID_TYPES.includes(type)) { values.push(type); clauses.push(`a.application_type::text = $${values.length}`); }
  if (from) { values.push(from); clauses.push(`a.created_at >= $${values.length}::date`); }
  if (to) { values.push(to); clauses.push(`a.created_at < ($${values.length}::date + INTERVAL '1 day')`); }
  return { values, where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '' };
};

const list = async ({ page = 1, limit = 20, search = '', status = '', type = '', from = '', to = '' }) => {
  const { values, where } = buildFilters({ search, status, type, from, to });
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM applications a
     JOIN researchers r ON r.id = a.researcher_id
     JOIN users u ON u.id = r.user_id
     ${where}`, values,
  );
  const offset = (page - 1) * limit;
  const rows = await pool.query(
    `SELECT a.id, a.application_number, a.application_type, a.status,
            a.research_title, a.created_at, a.updated_at,
            a.parent_application_id, parent.application_number AS parent_application_number,
            u.name AS researcher_name, u.email AS researcher_email,
            r.institution AS researcher_institution, r.category_id,
            CASE WHEN a.status::text = ANY($${values.length + 1}::text[]) THEN FALSE
                 ELSE TRUE END AS is_active,
            (a.status::text <> ALL($${values.length + 1}::text[])
              AND a.updated_at < NOW() - INTERVAL '7 days') AS is_overdue
     FROM applications a
     JOIN researchers r ON r.id = a.researcher_id
     JOIN users u ON u.id = r.user_id
     LEFT JOIN applications parent ON parent.id = a.parent_application_id
     ${where}
     ORDER BY a.updated_at DESC NULLS LAST, a.created_at DESC
     LIMIT $${values.length + 2} OFFSET $${values.length + 3}`,
    [...values, TERMINAL_STATUSES, limit, offset],
  );
  return {
    items: rows.rows,
    pagination: { page, limit, total: count.rows[0].total, total_pages: Math.ceil(count.rows[0].total / limit) },
  };
};

const summary = async ({ from = '', to = '' } = {}) => {
  const values = [];
  const clauses = [];
  if (from) { values.push(from); clauses.push(`created_at >= $${values.length}::date`); }
  if (to) { values.push(to); clauses.push(`created_at < ($${values.length}::date + INTERVAL '1 day')`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status::text <> ALL($${values.length + 1}::text[]))::int AS active,
      COUNT(*) FILTER (WHERE status::text = ANY($${values.length + 2}::text[]))::int AS completed,
      COUNT(*) FILTER (WHERE status::text = 'REJECTED')::int AS rejected,
      COUNT(*) FILTER (WHERE status::text <> ALL($${values.length + 1}::text[])
        AND updated_at < NOW() - INTERVAL '7 days')::int AS overdue
     FROM applications ${where}`,
    [...values, TERMINAL_STATUSES, COMPLETED_STATUSES],
  );
  const byStatus = await pool.query(
    `SELECT status::text AS status, COUNT(*)::int AS total
     FROM applications ${where}
     GROUP BY status::text ORDER BY total DESC, status::text ASC`,
    values,
  );
  const byType = await pool.query(
    `SELECT application_type::text AS application_type, COUNT(*)::int AS total
     FROM applications ${where}
     GROUP BY application_type::text ORDER BY total DESC, application_type::text ASC`,
    values,
  );
  return { ...result.rows[0], by_status: byStatus.rows, by_type: byType.rows };
};

const getHistory = async (applicationId) => {
  const app = await pool.query(
    `SELECT a.id, a.application_number, a.application_type, a.status,
            a.research_title, u.name AS researcher_name
     FROM applications a
     JOIN researchers r ON r.id = a.researcher_id
     JOIN users u ON u.id = r.user_id
     WHERE a.id = $1`, [applicationId],
  );
  if (!app.rows[0]) {
    const err = new Error('Application not found'); err.statusCode = 404; throw err;
  }
  const history = await pool.query(
    `SELECT h.id, h.previous_status, h.new_status, h.note, h.created_at,
            u.name AS changed_by_name,
            COALESCE((
              SELECT ARRAY_AGG(DISTINCT ro.name::text ORDER BY ro.name::text)
              FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id
              WHERE ur.user_id = h.changed_by
            ), ARRAY[]::text[]) AS changed_by_roles
     FROM application_status_histories h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.application_id = $1
     ORDER BY h.created_at ASC, h.id ASC`, [applicationId],
  );
  return { application: app.rows[0], history: history.rows };
};

module.exports = { list, summary, getHistory };
