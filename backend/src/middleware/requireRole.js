'use strict';

// Role authorization middleware. SRS FR-7.1, FR-7.2.
const AppError = require('../utils/AppError');

/**
 * Ensures authenticated user has one of the required roles.
 * SRS FR-7.1, FR-7.2: Role-based authorization.
 *
 * @param {...string} roles - Allowed roles (e.g. 'moderator', 'admin')
 * @returns {Function} Express middleware
 */
module.exports = function requireRole(...roles) {
  const allowedRoles = roles.flat();
  return function roleMiddleware(req, _res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
    }
    return next();
  };
};