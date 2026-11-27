'use strict';

const pool = require('../config/database');

const record = async ({ user = null, email = '', eventType, req, failureReason = null }) => {
  if (!eventType || !req) return;
  const isSuccess = eventType !== 'LOGIN_FAILED';
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  try {
    await pool.query(
      `INSERT INTO login_history
       (user_id, user_name, email, event_type, status, failure_reason, roles, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
      [
        user?.id || null,
        user?.name || null,
        String(email || user?.email || 'unknown').toLowerCase().trim().slice(0, 255),
        eventType,
        isSuccess ? 'SUCCESS' : 'FAILED',
        failureReason,
        JSON.stringify(roles),
        req.ip || null,
        req.get?.('user-agent') || null,
      ],
    );
  } catch (err) {
    console.error('Failed to persist login history:', err.message);
  }
};

const list = async ({ page = 1, limit = 25, search = '', status = '', from = '', to = '' }) => {
  const values = [];
  const filters = [];
  if (search) {
    values.push(`%${String(search).slice(0, 100)}%`);
    const p = values.length;
    filters.push(`(email ILIKE $${p} OR COALESCE(user_name, '') ILIKE $${p} OR COALESCE(ip_address, '') ILIKE $${p} OR COALESCE(user_agent, '') ILIKE $${p})`);
  }
  if (status && ['SUCCESS', 'FAILED'].includes(status)) {
    values.push(status); filters.push(`status = $${values.length}`);
  }
  if (from) { values.push(from); filters.push(`created_at >= $${values.length}::date`); }
  if (to) { values.push(to); filters.push(`created_at < ($${values.length}::date + INTERVAL '1 day')`); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM login_history ${where}`, values);
  const offset = (page - 1) * limit;
  const rows = await pool.query(
    `SELECT id, user_id, user_name, email, event_type, status, failure_reason, roles, ip_address, user_agent, created_at
     FROM login_history ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );
  const summary = await pool.query(
    `SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'SUCCESS')::int AS successful,
      COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS today
     FROM login_history`,
  );
  return {
    items: rows.rows,
    pagination: { page, limit, total: count.rows[0].total, total_pages: Math.ceil(count.rows[0].total / limit) },
    summary: summary.rows[0],
  };
};

module.exports = { record, list };
