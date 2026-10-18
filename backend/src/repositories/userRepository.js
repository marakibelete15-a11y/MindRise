'use strict';

// User account queries. SRS FR-1.1, FR-1.2, FR-7.5.
const pool = require('../config/db');

/**
 * Loads current authentication context for a user.
 * SRS FR-1.1, FR-1.2, FR-7.5: auth middleware user lookup.
 * HARD PRIVACY RULE: Never selects names, email, phone, or credentials.
 *
 * @param {string} id - User UUID
 * @param {object} [client] - Optional db client for transactions
 * @returns {Promise<object|null>} Auth context or null if not found
 */
async function findAuthContextById(id, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    SELECT
      u.id,
      u.role,
      u.status,
      u.restricted_until,
      (vi.email_verified_at IS NOT NULL OR vi.phone_verified_at IS NOT NULL) AS verified
    FROM users u
    LEFT JOIN verified_identities vi ON vi.user_id = u.id
    WHERE u.id = $1 AND u.deleted_at IS NULL
  `;
  const result = await queryExecutor.query(sql, [id]);
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  return {
    id: row.id,
    role: row.role,
    status: row.status,
    restrictedUntil: row.restricted_until ? new Date(row.restricted_until).toISOString() : null,
    verified: Boolean(row.verified),
  };
}

async function createUser(user, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    INSERT INTO users (id, role, status, password_hash)
    VALUES ($1, $2, $3, $4)
    RETURNING id, role, status, created_at
  `;
  const values = [
    user.id,
    user.role || 'youth',
    user.status || 'active',
    user.passwordHash,
  ];
  const result = await queryExecutor.query(sql, values);
  return result.rows[0];
}

/**
 * Initializes default user settings.
 * SRS FR-5.2.
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<void>}
 */
async function createUserSettings(userId, client = null) {
  const queryExecutor = client || pool;
  await queryExecutor.query(
    'INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
    [userId]
  );
}

/**
 * Initializes default user stats (zeros).
 * Migration 012.
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<void>}
 */
async function createUserStats(userId, client = null) {
  const queryExecutor = client || pool;
  await queryExecutor.query(
    'INSERT INTO user_stats (user_id, points, current_streak, best_streak) VALUES ($1, 0, 0, 0) ON CONFLICT (user_id) DO NOTHING',
    [userId]
  );
}

module.exports = {
  findAuthContextById,
  createUser,
  createUserSettings,
  createUserStats,
};