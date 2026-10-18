'use strict';

// JWT issuance and verification helpers. SRS 2.7, FR-1.1.
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('./AppError');

/**
 * Signs an access token for a user.
 * SRS 2.7, FR-1.1: JWT sessions.
 * Claims include only sub (user ID) and role. Never includes names, contact data, or handle.
 *
 * @param {object} user - User object with id and role
 * @returns {string} JWT access token
 */
function signAccessToken(user) {
  if (!user || !user.id) {
    throw new Error('User ID is required to sign access token.');
  }
  const payload = {
    sub: user.id,
    role: user.role,
  };
  return jwt.sign(payload, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: env.jwtExpiresIn,
  });
}

/**
 * Verifies an access token.
 * SRS 2.7, FR-1.1: JWT verification.
 * Explicitly pins algorithms: ['HS256'] to prevent algorithm confusion attacks and alg: none.
 *
 * @param {string} token - JWT token string
 * @returns {object} Decoded claims
 */
function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') {
    throw new AppError(401, 'INVALID_TOKEN', 'The access token is invalid or has expired.');
  }
  try {
    const decoded = jwt.verify(token, env.jwtSecret, {
      algorithms: ['HS256'],
    });
    return decoded;
  } catch (_error) {
    throw new AppError(401, 'INVALID_TOKEN', 'The access token is invalid or has expired.');
  }
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
};