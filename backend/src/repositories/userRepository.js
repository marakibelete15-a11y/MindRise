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
      u.password_changed_at,
      (vi.email_verified_at IS NOT NULL OR vi.phone_verified_at IS NOT NULL) AS verified
    FROM users u
    LEFT JOIN verified_identities vi ON vi.user_id = u.id
    WHERE u.id = $1 AND (u.deleted_at IS NULL OR u.status = 'deletion_pending')
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
    passwordChangedAt: row.password_changed_at ? new Date(row.password_changed_at) : null,
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

/**
 * Updates a user's password hash and sets password_changed_at to now().
 * SRS FR-1.8.
 *
 * @param {string} userId
 * @param {string} passwordHash
 * @param {object} [client]
 * @returns {Promise<void>}
 */
async function updatePassword(userId, passwordHash, client = null) {
  const queryExecutor = client || pool;
  await queryExecutor.query(
    `UPDATE users
     SET password_hash = $1, password_changed_at = now(), updated_at = now()
     WHERE id = $2`,
    [passwordHash, userId]
  );
}

/**
 * Gets a user's settings.
 * SRS FR-5.2.
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function getUserSettings(userId, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    SELECT
      language_code AS language,
      timezone,
      push_enabled AS "pushEnabled",
      email_enabled AS "emailEnabled",
      profile_visibility AS "profileVisibility"
    FROM user_settings
    WHERE user_id = $1
  `;
  const result = await queryExecutor.query(sql, [userId]);
  return result.rows[0] || null;
}

/**
 * Updates a user's settings.
 * SRS FR-5.2.
 *
 * @param {string} userId
 * @param {object} data
 * @param {object} [client]
 * @returns {Promise<object>} Updated settings
 */
async function updateUserSettings(userId, data, client = null) {
  const queryExecutor = client || pool;
  const updates = [];
  const values = [userId];
  let paramIdx = 2;

  if (data.language !== undefined) {
    updates.push(`language_code = $${paramIdx++}`);
    values.push(data.language);
  }
  if (data.timezone !== undefined) {
    updates.push(`timezone = $${paramIdx++}`);
    values.push(data.timezone);
  }
  if (data.pushEnabled !== undefined) {
    updates.push(`push_enabled = $${paramIdx++}`);
    values.push(data.pushEnabled);
  }
  if (data.emailEnabled !== undefined) {
    updates.push(`email_enabled = $${paramIdx++}`);
    values.push(data.emailEnabled);
  }
  if (data.profileVisibility !== undefined) {
    updates.push(`profile_visibility = $${paramIdx++}`);
    values.push(data.profileVisibility);
  }

  updates.push(`updated_at = now()`);

  const sql = `
    UPDATE user_settings
    SET ${updates.join(', ')}
    WHERE user_id = $1
    RETURNING
      language_code AS language,
      timezone,
      push_enabled AS "pushEnabled",
      email_enabled AS "emailEnabled",
      profile_visibility AS "profileVisibility"
  `;
  const result = await queryExecutor.query(sql, values);
  return result.rows[0];
}

module.exports = {
  findAuthContextById,
  createUser,
  createUserSettings,
  createUserStats,
  updatePassword,
  getUserSettings,
  updateUserSettings,
};