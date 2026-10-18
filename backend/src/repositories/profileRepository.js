'use strict';

// Public profile queries. SRS FR-1.3, FR-1.7, 5.4.
const pool = require('../config/db');

/**
 * Creates a public profile record for a user.
 * SRS FR-1.3.
 *
 * @param {object} data
 * @param {string} data.userId
 * @param {string} data.alias
 * @param {string|null} [data.avatarPath=null]
 * @param {string|null} [data.bio=null]
 * @param {object} [client]
 * @returns {Promise<object>} Created profile
 */
async function createProfile(data, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    INSERT INTO profiles (user_id, alias, avatar_path, bio)
    VALUES ($1, $2, $3, $4)
    RETURNING user_id, alias, avatar_path, bio, created_at
  `;
  const values = [data.userId, data.alias, data.avatarPath || null, data.bio || null];
  const result = await queryExecutor.query(sql, values);
  return result.rows[0];
}

/**
 * Finds a profile by alias (case-insensitive).
 *
 * @param {string} alias
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function findByAlias(alias, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    SELECT user_id, alias, avatar_path, bio
    FROM profiles
    WHERE lower(alias) = lower($1)
  `;
  const result = await queryExecutor.query(sql, [alias]);
  return result.rows[0] || null;
}

/**
 * Finds a profile by user ID.
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function findByUserId(userId, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    SELECT user_id, alias, avatar_path, bio
    FROM profiles
    WHERE user_id = $1
  `;
  const result = await queryExecutor.query(sql, [userId]);
  return result.rows[0] || null;
}

module.exports = {
  createProfile,
  findByAlias,
  findByUserId,
};