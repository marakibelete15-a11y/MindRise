'use strict';

// Verified-account gate middleware. SRS FR-1.2.
const AppError = require('../utils/AppError');

/**
 * Ensures authenticated user has verified contact credentials.
 * SRS FR-1.2: Posting privileges only after verification.
 *
 * @param {object} req - Express request
 * @param {object} _res - Express response
 * @param {Function} next - Express next handler
 */
module.exports = function requireVerified(req, _res, next) {
  if (!req.user || !req.user.verified) {
    return next(new AppError(403, 'NOT_VERIFIED', 'Account verification is required to perform this action.'));
  }
  return next();
};