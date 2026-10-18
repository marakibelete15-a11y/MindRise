'use strict';

// Temporary posting restriction gate middleware. SRS FR-7.5, FR-7.7.
const AppError = require('../utils/AppError');

/**
 * Ensures user is not currently under a temporary posting restriction.
 * SRS FR-7.5: Posting restriction check.
 *
 * @param {object} req - Express request
 * @param {object} _res - Express response
 * @param {Function} next - Express next handler
 */
module.exports = function notRestricted(req, _res, next) {
  if (req.user && req.user.restrictedUntil) {
    const restrictedUntilDate = new Date(req.user.restrictedUntil);
    if (!Number.isNaN(restrictedUntilDate.getTime()) && restrictedUntilDate > new Date()) {
      return next(
        new AppError(
          403,
          'ACCOUNT_RESTRICTED',
          'Your account is currently restricted from performing this action.',
          { restrictedUntil: req.user.restrictedUntil },
        ),
      );
    }
  }
  return next();
};