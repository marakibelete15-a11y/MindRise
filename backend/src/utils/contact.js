'use strict';

// Contact normalization and validation helpers. SRS FR-1.1, FR-1.5.
const AppError = require('./AppError');

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/**
 * Normalizes and validates an email address.
 * Trims whitespace and converts to lower case.
 *
 * @param {string} email
 * @returns {string} Normalized email
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'A valid email address is required.');
  }
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid email address format.');
  }
  return normalized;
}

/**
 * Normalizes and validates a phone number to standard E.164.
 * Converts local Ethiopian numbers (e.g., 0911223344 or 0711223344) to +251...
 *
 * @param {string} phone
 * @returns {string} Normalized E.164 phone string
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'A valid phone number is required.');
  }
  let cleaned = phone.replace(/[\s\-\(\)]/g, '').trim();

  // Local Ethiopian format starting with 0 (e.g., 09... or 07...)
  if (cleaned.startsWith('0')) {
    cleaned = '+251' + cleaned.slice(1);
  } else if (cleaned.startsWith('251')) {
    cleaned = '+' + cleaned;
  }

  if (!E164_REGEX.test(cleaned)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid phone number. Must be a valid E.164 phone number.');
  }
  return cleaned;
}

/**
 * Determines whether an identifier looks like an email or phone number.
 *
 * @param {string} identifier
 * @returns {'email'|'phone'}
 */
function detectContactType(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Identifier is required.');
  }
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) {
    return 'email';
  }
  return 'phone';
}

module.exports = {
  normalizeEmail,
  normalizePhone,
  detectContactType,
  EMAIL_REGEX,
  E164_REGEX,
};
