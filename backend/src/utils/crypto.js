'use strict';

// Authenticated application-level encryption at rest. SRS 5.4 (Decision C).
const crypto = require('node:crypto');
const env = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // 96 bits for AES-GCM
const KEY_LENGTH_BYTES = 32; // 256 bits

function getKeyBuffer(overrideKey = null) {
  const rawKey = overrideKey || env.dataEncryptionKey;
  if (!rawKey) {
    throw new Error('DATA_ENCRYPTION_KEY is required for encryption.');
  }
  const keyBuf = Buffer.isBuffer(rawKey) ? rawKey : Buffer.from(rawKey, 'base64');
  if (keyBuf.length !== KEY_LENGTH_BYTES) {
    throw new Error(`DATA_ENCRYPTION_KEY must be exactly ${KEY_LENGTH_BYTES} bytes.`);
  }
  return keyBuf;
}

// Validate default key at startup
getKeyBuffer();

/**
 * Encrypts plaintext string using AES-256-GCM.
 * SRS 5.4: Encryption at rest.
 * Uses a new random 12-byte IV for every invocation.
 *
 * @param {string} text - Plaintext to encrypt
 * @param {string|Buffer} [keyOverride] - Optional key for testing/rotation
 * @returns {string} Formatted string "v1:<iv>:<authTag>:<ciphertext>"
 */
function encrypt(text, keyOverride = null) {
  if (typeof text !== 'string') {
    throw new TypeError('Plaintext must be a string.');
  }
  const key = getKeyBuffer(keyOverride);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypts a payload encrypted with encrypt().
 * SRS 5.4: Encryption at rest.
 * Verifies auth tag and throws on tampering, wrong key, or bad format.
 *
 * @param {string} payload - Payload formatted as "v1:<iv>:<authTag>:<ciphertext>"
 * @param {string|Buffer} [keyOverride] - Optional key for testing/rotation
 * @returns {string} Decrypted plaintext string
 */
function decrypt(payload, keyOverride = null) {
  if (typeof payload !== 'string') {
    throw new TypeError('Payload must be a string.');
  }

  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid ciphertext format.');
  }

  const iv = Buffer.from(parts[1], 'base64');
  const authTag = Buffer.from(parts[2], 'base64');
  const ciphertext = Buffer.from(parts[3], 'base64');

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== 16) {
    throw new Error('Invalid ciphertext component lengths.');
  }

  const key = getKeyBuffer(keyOverride);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch (_error) {
    throw new Error('Decryption failed: tampered ciphertext or wrong key.');
  }
}

/**
 * Encrypts a JSON-serializable object.
 * SRS 5.4: Encryption at rest.
 *
 * @param {any} obj - Object to serialize and encrypt
 * @param {string|Buffer} [keyOverride] - Optional key for testing/rotation
 * @returns {string} Ciphertext string
 */
function encryptJson(obj, keyOverride = null) {
  return encrypt(JSON.stringify(obj), keyOverride);
}

/**
 * Decrypts a ciphertext payload and parses it as JSON.
 * SRS 5.4: Encryption at rest.
 *
 * @param {string} payload - Ciphertext payload
 * @param {string|Buffer} [keyOverride] - Optional key for testing/rotation
 * @returns {any} Parsed JavaScript object
 */
function decryptJson(payload, keyOverride = null) {
  const decrypted = decrypt(payload, keyOverride);
  return JSON.parse(decrypted);
}

module.exports = {
  encrypt,
  decrypt,
  encryptJson,
  decryptJson,
};
