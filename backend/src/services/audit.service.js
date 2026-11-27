'use strict';

const pool = require('../config/database');

const sanitizeValue = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== 'object') return value;
  const blocked = /password|token|secret|authorization|cookie|credential|otp/i;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !blocked.test(key))
      .map(([key, nested]) => [key, sanitizeValue(nested)]),
  );
};

const getSafeBody = (body) => {
  if (!body || typeof body !== 'object') return null;
  return sanitizeValue(body);
};

const resolveEntity = (req, fallback = 'SYSTEM') => {
  const url = String(req.originalUrl || req.baseUrl || '').split('?')[0];
  const segments = url.split('/').filter(Boolean);
  const known = segments.find((segment) =>
    /^(applications?|researchers?|users?|reviews?|assignments?|documents?|letters?|settings?|diklit)$/i.test(segment),
  );
  const entityType = known
    ? (known.toLowerCase() === 'diklit' ? 'APPLICATION' : known.replace(/s$/i, '').toUpperCase())
    : fallback;
  const routeId = url.match(/\/(?:applications?|diklit|reviews?|assignments?|users?|documents?|letters?)\/(\d+)(?:\/|$)/i)?.[1];
  const rawId = req.params?.id || req.params?.applicationId || routeId || null;
  const entityId = rawId && /^\d+$/.test(String(rawId)) ? String(rawId) : null;
  return { entityType, entityId };
};

const recordAuditEvent = async ({
  user = null,
  action,
  req,
  entityType,
  entityId = null,
  oldData = null,
  newData = null,
  statusCode = null,
}) => {
  if (!req || !action) return;

  // Authentication events are intentionally excluded from the audit trail.
  const normalizedAction = String(action).trim().toUpperCase();
  const normalizedEntityType = String(entityType || '').trim().toUpperCase();
  if (normalizedEntityType === 'AUTH' || /(^|_)(LOGIN|LOGOUT)(_|$)/.test(normalizedAction)) return;

  const entity = entityType ? { entityType, entityId } : resolveEntity(req);
  const method = String(req.method || '').toUpperCase().slice(0, 10) || null;
  const path = String(req.originalUrl || req.path || '').split('?')[0] || null;
  const responseStatus = Number.isInteger(statusCode) ? statusCode : null;
  const before = oldData ?? req.auditOldData ?? null;

  try {
    await pool.query(
      `INSERT INTO audit_logs
       (user_id, user_role_id, action, entity_type, entity_id,
        old_data, new_data, ip_address, user_agent, method, path, status_code)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12)`,
      [
        user?.id || null,
        user?.user_role_id || null,
        String(action).slice(0, 100),
        String(entity.entityType || 'SYSTEM').slice(0, 50),
        entity.entityId || null,
        before == null ? null : JSON.stringify(sanitizeValue(before)),
        newData == null ? null : JSON.stringify(sanitizeValue(newData)),
        req.ip || null,
        req.get?.('user-agent') || null,
        method,
        path,
        responseStatus,
      ],
    );
  } catch (err) {
    console.error('Failed to persist audit event:', err.message);
  }
};

const recordAuthEvent = async ({ user = null, email = null, action, req, statusCode = null }) => {
  await recordAuditEvent({
    user,
    action,
    req,
    entityType: 'AUTH',
    statusCode,
    newData: email ? { email } : null,
  });
};

module.exports = { recordAuditEvent, recordAuthEvent, getSafeBody, resolveEntity };
