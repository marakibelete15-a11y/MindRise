'use strict';

// Test authentication and user generation helpers.
// SRS FR-1.1, FR-1.2, FR-7.5.
// Generates test users with isolated fake identity records in the test database,
// registers them for automatic cleanup, and issues access tokens.

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { signAccessToken } = require('../../src/utils/tokens');

/**
 * Creates a complete test user in the test database.
 * SRS FR-1.1, FR-1.2, FR-7.5.
 *
 * @param {object} [options]
 * @param {string} [options.role='youth'] - 'youth' | 'moderator' | 'admin'
 * @param {boolean} [options.verified=true] - Whether email/phone is verified
 * @param {string} [options.status='active'] - 'active' | 'suspended' | 'banned' | 'deletion_pending'
 * @param {string|Date|null} [options.restrictedUntil=null] - Date of restriction expiry
 * @param {string} [options.alias] - Custom public handle
 * @returns {Promise<object>} Created user context
 */
async function createTestUser(options = {}) {
  const {
    role = 'youth',
    verified = true,
    status = 'active',
    restrictedUntil = null,
    alias: customAlias = null,
  } = options;

  const userId = crypto.randomUUID();
  const alias = customAlias || `test_${crypto.randomBytes(4).toString('hex')}`;
  const fakeEmail = `${alias}@example.test`;
  const passwordHash = await bcrypt.hash('TestPassword123!', 4); // Low cost for test speed

  const restrictedUntilDate = restrictedUntil ? new Date(restrictedUntil) : null;
  const verifiedAt = verified ? new Date() : null;

  // 1. Insert users table
  await db.query(
    `INSERT INTO users (id, role, status, password_hash, restricted_until)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, role, status, passwordHash, restrictedUntilDate]
  );

  // 2. Insert verified_identities with fake data
  await db.query(
    `INSERT INTO verified_identities (user_id, first_name, last_name, email, email_verified_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, 'FakeFirst', 'FakeLast', fakeEmail, verifiedAt]
  );

  // 3. Insert profiles table
  await db.query(
    `INSERT INTO profiles (user_id, alias, bio)
     VALUES ($1, $2, $3)`,
    [userId, alias, 'Test bio']
  );

  // 4. Insert user_settings table
  await db.query(
    `INSERT INTO user_settings (user_id)
     VALUES ($1)`,
    [userId]
  );

  // Track for automated test cleanup
  db.trackUser(userId);

  return {
    id: userId,
    role,
    status,
    verified: Boolean(verified),
    restrictedUntil: restrictedUntilDate ? restrictedUntilDate.toISOString() : null,
    alias,
  };
}

/**
 * Creates a signed JWT access token for a test user.
 * SRS 2.7, FR-1.1.
 *
 * @param {object} user - User with id and role
 * @returns {string} Signed access token
 */
function makeToken(user) {
  return signAccessToken(user);
}

module.exports = {
  createTestUser,
  makeToken,
};
