'use strict';
const { error } = require('../utils/response');

/**
 * Authorize middleware — checks that req.user has at least one of the required roles.
 * Must be used after authenticate middleware.
 */
const authorize = (...requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'Authentication required', 401);
    }
    const userRoles = req.user.roles || [];
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));
    if (!hasRole) {
      return error(res, 'Forbidden: insufficient permissions', 403);
    }
    next();
  };
};

module.exports = { authorize };
