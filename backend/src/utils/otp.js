'use strict';

// OTP generation and verification helpers. SRS FR-1.1, FR-1.2, FR-1.8.
const crypto = require('node:crypto');

/**
 * Generates a 6-digit OTP code using cryptographically secure random integers.
 * Hard Rule 5: Never Math.random.
 *
 * @returns {string} 6-digit numeric string (100000 to 999999)
 */
function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hashes a 6-digit OTP code using HMAC-SHA256 with OTP_PEPPER.
 * Protects against offline brute-force attacks on low-entropy 6-digit codes.
 *
 * @param {string} code - 6-digit numeric OTP code
 * @param {string} pepper - Pepper secret
 * @returns {string} Hex-encoded HMAC-SHA256
 */
function hashOtp(code, pepper) {
  if (!pepper) {
    throw new Error('OTP_PEPPER is required for hashing OTP codes.');
  }
  return crypto.createHmac('sha256', pepper).update(String(code)).digest('hex');
}

/**
 * Verifies a 6-digit OTP code against stored HMAC-SHA256 hash in constant time.
 * Hard Rule 5: Constant-time comparison using timingSafeEqual on equal-length buffers.
 *
 * @param {string} candidateCode - Candidate 6-digit code
 * @param {string} storedHash - Stored hex HMAC
 * @param {string} pepper - Pepper secret
 * @returns {boolean} True if matched
 */
function verifyOtp(candidateCode, storedHash, pepper) {
  if (!candidateCode || !storedHash || !pepper) {
    return false;
  }
  const candidateHash = hashOtp(candidateCode, pepper);
  const bufA = Buffer.from(candidateHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');

  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  generateOtp,
  hashOtp,
  verifyOtp,
};