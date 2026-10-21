'use strict';

// Rate-limiting middleware policies. SRS FR-1.x, FR-4.x, FR-7.5.
const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';

function defaultHandler(_req, res, _next, options) {
  return res.status(options.statusCode || 429).json({
    error: {
      code: 'RATE_LIMITED',
      message: options.message || 'Too many requests. Please try again later.',
    },
  });
}

function shouldSkip(req) {
  // In test environment, skip rate limits unless explicitly enabled for rate-limit testing
  return isTest && req.headers['x-test-rate-limit'] !== 'true';
}

/**
 * General API limiter: 100 requests per 1 minute per IP.
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests. Please slow down.',
  handler: defaultHandler,
  skip: shouldSkip,
});

/**
 * Signup limiter: 5 registrations per 1 hour per IP.
 */
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many registration attempts from this IP. Please try again later.',
  handler: defaultHandler,
  skip: shouldSkip,
});

/**
 * Login limiter: 10 attempts per 15 minutes per IP + identifier.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const identifier = req.body && req.body.identifier ? String(req.body.identifier).toLowerCase().trim() : '';
    return `${ip}_${identifier}`;
  },
  validate: { xForwardedForHeader: false, default: true },
  message: 'Too many login attempts. Please try again in 15 minutes.',
  handler: defaultHandler,
  skip: shouldSkip,
});

/**
 * OTP verification limiter: 10 attempts per 15 minutes per user/IP.
 */
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = req.user ? req.user.id : (req.body && req.body.userId ? req.body.userId : '');
    return `${ip}_${userId}`;
  },
  validate: { xForwardedForHeader: false, default: true },
  message: 'Too many verification attempts. Please try again in 15 minutes.',
  handler: defaultHandler,
  skip: shouldSkip,
});

/**
 * Recovery request limiter: 5 attempts per 1 hour per IP + identifier.
 */
const recoveryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const identifier = req.body && req.body.identifier ? String(req.body.identifier).toLowerCase().trim() : '';
    return `${ip}_${identifier}`;
  },
  validate: { xForwardedForHeader: false, default: true },
  message: 'Too many recovery attempts. Please try again in 1 hour.',
  handler: defaultHandler,
  skip: shouldSkip,
});

module.exports = generalLimiter;
module.exports.generalLimiter = generalLimiter;
module.exports.signupLimiter = signupLimiter;
module.exports.loginLimiter = loginLimiter;
module.exports.otpVerifyLimiter = otpVerifyLimiter;
module.exports.recoveryLimiter = recoveryLimiter;