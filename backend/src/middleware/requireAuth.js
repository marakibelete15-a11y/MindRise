'use strict';

// Authentication middleware. SRS 2.7, FR-1.1, FR-1.8, FR-5.4.
const AppError = require('../utils/AppError');
const { verifyAccessToken } = require('../utils/tokens');
const userRepository = require('../repositories/userRepository');

async function handleAuth(options, req, _res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      throw new AppError(401, 'INVALID_TOKEN', 'Authentication token is required.');
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new AppError(401, 'INVALID_TOKEN', 'Authentication token must be a Bearer token.');
    }

    const token = match[1].trim();
    const claims = verifyAccessToken(token);

    const user = await userRepository.findAuthContextById(claims.sub);
    if (!user) {
      throw new AppError(401, 'INVALID_TOKEN', 'Authentication token is invalid.');
    }

    if (user.status === 'suspended' || user.status === 'banned') {
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended.');
    }

    if (user.status === 'deletion_pending' && !options.allowDeletionPending) {
      throw new AppError(403, 'ACCOUNT_DELETION_PENDING', 'Your account is scheduled for deletion.');
    }

    // Set authenticated user context using database values (role from DB, never token)
    req.user = {
      id: user.id,
      role: user.role,
      status: user.status,
      verified: Boolean(user.verified),
      restrictedUntil: user.restrictedUntil,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Authentication middleware.
 * Can be used as requireAuth or requireAuth({ allowDeletionPending: true }).
 * SRS 2.7, FR-1.1, FR-1.8, FR-5.4.
 */
module.exports = function requireAuth(optionsOrReq, res, next) {
  if (optionsOrReq && optionsOrReq.headers && typeof next === 'function') {
    return handleAuth({}, optionsOrReq, res, next);
  }
  const options = optionsOrReq || {};
  return (req, response, nextHandler) => handleAuth(options, req, response, nextHandler);
};