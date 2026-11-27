'use strict';

const pool = require('../config/database');
const { recordAuditEvent, getSafeBody, resolveEntity } = require('../services/audit.service');

// Static, allowlisted snapshot queries only. Never interpolate a table or column
// name from request input. Sensitive user fields are excluded explicitly.
const getSnapshotQuery = (req) => {
  const url = String(req.originalUrl || '').split('?')[0];

  let match = url.match(/\/applications\/(\d+)(?:\/|$)/i);
  if (match) return {
    entityType: 'APPLICATION', entityId: match[1],
    sql: 'SELECT to_jsonb(a) AS snapshot FROM applications a WHERE a.id = $1 LIMIT 1',
  };

  match = url.match(/\/reviews\/(\d+)(?:\/|$)/i);
  if (match) return {
    entityType: 'REVIEW', entityId: match[1],
    sql: `SELECT to_jsonb(r) || jsonb_build_object(
      'assessment', (SELECT to_jsonb(ra) FROM review_assessments ra WHERE ra.review_id = r.id)
    ) AS snapshot FROM reviews r WHERE r.id = $1 LIMIT 1`,
  };

  // Reviewer assignment endpoints use /assignments/:id. The application
  // assignment endpoint /assignments/applications/:id is handled separately.
  match = url.match(/\/assignments\/(\d+)(?:\/|$)/i);
  if (match) return {
    entityType: 'ASSIGNMENT', entityId: match[1],
    sql: 'SELECT to_jsonb(ra) AS snapshot FROM review_assignments ra WHERE ra.id = $1 LIMIT 1',
  };

  match = url.match(/\/users\/(\d+)(?:\/|$)/i);
  if (match) return {
    entityType: 'USER', entityId: match[1],
    sql: `SELECT (to_jsonb(u) - 'password') || jsonb_build_object(
      'roles', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('user_role_id', ur.id, 'role', r.name))
        FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id
      ), '[]'::jsonb)
    ) AS snapshot FROM users u WHERE u.id = $1 LIMIT 1`,
  };

  match = url.match(/\/letters\/(\d+)(?:\/|$)/i);
  if (match) return {
    entityType: 'LETTER', entityId: match[1],
    sql: 'SELECT to_jsonb(l) AS snapshot FROM letters l WHERE l.id = $1 LIMIT 1',
  };

  return null;
};

const readSnapshot = async (descriptor) => {
  if (!descriptor) return null;
  const result = await pool.query(descriptor.sql, [descriptor.entityId]);
  return result.rows[0]?.snapshot || null;
};

const auditTrail = async (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const descriptor = getSnapshotQuery(req);
  let oldData = null;

  try {
    oldData = await readSnapshot(descriptor);
  } catch (err) {
    console.error('Failed to capture pre-change audit snapshot:', err.message);
  }

  res.once('finish', () => {
    const statusCode = res.statusCode;
    const resolved = resolveEntity(req);
    const entityType = descriptor?.entityType || resolved.entityType;
    const entityId = descriptor?.entityId || resolved.entityId;
    const suffix = statusCode >= 400 ? 'FAILED' : 'SUCCESS';
    const action = `${req.method}_${entityType}_${suffix}`;

    void (async () => {
      let newData = req.method === 'DELETE' ? null : getSafeBody(req.body);

      // For updates, prefer the persisted post-action state over the request
      // payload. For failed requests, retain only the submitted safe payload.
      if (statusCode < 400 && descriptor && req.method !== 'DELETE') {
        try {
          newData = await readSnapshot(descriptor) || newData;
        } catch (err) {
          console.error('Failed to capture post-change audit snapshot:', err.message);
        }
      }

      await recordAuditEvent({
        user: req.user || null,
        action,
        req,
        entityType,
        entityId,
        oldData,
        newData,
        statusCode,
      });
    })();
  });

  return next();
};

module.exports = { auditTrail };
