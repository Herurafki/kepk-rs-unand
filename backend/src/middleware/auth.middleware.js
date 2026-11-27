'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const userModel = require('../models/user.model');
const { error } = require('../utils/response');

const authenticate = async (req, res, next) => {
  let token = req.cookies?.penma_access_token;
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.slice(7);
  }

  if (!token) return error(res, 'Authentication required', 401);

  try {
    const payload = verifyAccessToken(token);
    const user = await userModel.findById(payload.sub);

    if (payload.sid) {
      const session = await userModel.findRefreshTokenById(payload.sid);
      if (!session || String(session.user_id) !== String(payload.sub) || session.revoked_at || new Date(session.expires_at) <= new Date()) {
        return error(res, 'Sesi tidak valid atau telah berakhir. Silakan login kembali.', 401);
      }
      const settings = await userModel.getIdleSettings();
      const lastActivity = new Date(session.last_activity_at || session.created_at || session.expires_at);
      if (Date.now() - lastActivity.getTime() >= settings.idle_timeout_minutes * 60 * 1000) {
        await userModel.revokeRefreshToken(session.token);
        return error(res, 'Sesi berakhir karena tidak ada aktivitas. Silakan login kembali.', 401);
      }
      await require('../config/database').query(
        'UPDATE refresh_tokens SET last_activity_at = NOW() WHERE id = $1 AND last_activity_at < NOW() - INTERVAL \'1 minute\' AND revoked_at IS NULL',
        [payload.sid]
      );
    }

    if (!user || !user.is_active) {
      return error(res, 'Account is deactivated or unavailable', 401);
    }

    const assignedRoles = await userModel.findRolesByUserId(payload.sub);
    const tokenRoles = payload.roles || [];
    const primaryRole = assignedRoles.find((role) => tokenRoles.includes(role.name));

    req.user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      roles: tokenRoles,
      user_role_id: primaryRole?.user_role_id || null,
    };
    return require('./audit-trail.middleware').auditTrail(req, res, next);
  } catch (err) {
    if (err.name === 'TokenExpiredError') return error(res, 'Token has expired', 401);
    if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
      return error(res, 'Invalid token', 401);
    }
    return next(err);
  }
};

module.exports = { authenticate };
