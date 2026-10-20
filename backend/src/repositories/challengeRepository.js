'use strict';

// Verification challenge queries. SRS FR-1.1, FR-1.2, FR-1.8.
const pool = require('../config/db');

/**
 * Creates a new verification challenge.
 * SRS FR-1.1, FR-1.2.
 *
 * @param {object} data
 * @param {string} data.userId
 * @param {'email'|'phone'} data.channel
 * @param {'signup'|'recovery'|'contact_change'} data.purpose
 * @param {string} data.tokenHash - HMAC-SHA256 of the 6-digit code
 * @param {Date|string} data.expiresAt
 * @param {object} [client]
 * @returns {Promise<object>} Created challenge
 */
async function createChallenge(data, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    INSERT INTO verification_challenges (
      user_id, channel, purpose, token_hash, expires_at, attempts
    )
    VALUES ($1, $2, $3, $4, $5, 0)
    RETURNING id, user_id, channel, purpose, expires_at, attempts, created_at
  `;
  const values = [
    data.userId,
    data.channel,
    data.purpose || 'signup',
    data.tokenHash,
    data.expiresAt,
  ];
  const result = await queryExecutor.query(sql, values);
  return result.rows[0];
}

/**
 * Finds the latest unconsumed, unexpired signup challenge for a user.
 * SRS FR-1.2.
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function findLatestUnconsumedSignupChallenge(userId, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    SELECT id, user_id, channel, purpose, token_hash, expires_at, attempts, created_at
    FROM verification_challenges
    WHERE user_id = $1
      AND purpose = 'signup'
      AND consumed_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const result = await queryExecutor.query(sql, [userId]);
  return result.rows[0] || null;
}

/**
 * Increments the attempts counter on a challenge.
 * SRS FR-1.2: Increment BEFORE comparing.
 *
 * @param {string} challengeId
 * @param {object} [client]
 * @returns {Promise<number>} New attempts count
 */
async function incrementAttempts(challengeId, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    UPDATE verification_challenges
    SET attempts = attempts + 1
    WHERE id = $1
    RETURNING attempts
  `;
  const result = await queryExecutor.query(sql, [challengeId]);
  return result.rows[0]?.attempts ?? 0;
}

/**
 * Marks a challenge as consumed.
 * SRS FR-1.2.
 *
 * @param {string} challengeId
 * @param {object} [client]
 * @returns {Promise<void>}
 */
async function consumeChallenge(challengeId, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    UPDATE verification_challenges
    SET consumed_at = now()
    WHERE id = $1
  `;
  await queryExecutor.query(sql, [challengeId]);
}

/**
 * Consumes any older unconsumed signup challenges for a user.
 * SRS FR-1.2: Called before generating a new resend challenge.
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<void>}
 */
async function consumeOlderSignupChallenges(userId, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    UPDATE verification_challenges
    SET consumed_at = now()
    WHERE user_id = $1
      AND purpose = 'signup'
      AND consumed_at IS NULL
  `;
  await queryExecutor.query(sql, [userId]);
}

/**
 * Counts challenges created within the given window in seconds.
 *
 * @param {string} userId
 * @param {string} purpose
 * @param {number} windowSeconds
 * @param {object} [client]
 * @returns {Promise<number>}
 */
async function getRecentResendCount(userId, purpose, windowSeconds, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    SELECT count(*)::int AS count
    FROM verification_challenges
    WHERE user_id = $1
      AND purpose = $2
      AND created_at >= (now() - ($3 || ' seconds')::interval)
  `;
  const result = await queryExecutor.query(sql, [userId, purpose, windowSeconds]);
  return result.rows[0]?.count ?? 0;
}

/**
 * Gets the most recent challenge for a user and purpose.
 *
 * @param {string} userId
 * @param {string} purpose
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function getLatestChallenge(userId, purpose, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    SELECT id, created_at, expires_at, consumed_at
    FROM verification_challenges
    WHERE user_id = $1
      AND purpose = $2
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const result = await queryExecutor.query(sql, [userId, purpose]);
  return result.rows[0] || null;
}

/**
 * Finds the latest unconsumed, unexpired recovery challenge for a user.
 * SRS FR-1.8.
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function findLatestUnconsumedRecoveryChallenge(userId, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    SELECT id, user_id, channel, purpose, token_hash, expires_at, attempts, created_at
    FROM verification_challenges
    WHERE user_id = $1
      AND purpose = 'recovery'
      AND consumed_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const result = await queryExecutor.query(sql, [userId]);
  return result.rows[0] || null;
}

/**
 * Consumes any older unconsumed recovery challenges for a user.
 * SRS FR-1.8.
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<void>}
 */
async function consumeOlderRecoveryChallenges(userId, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    UPDATE verification_challenges
    SET consumed_at = now()
    WHERE user_id = $1
      AND purpose = 'recovery'
      AND consumed_at IS NULL
  `;
  await queryExecutor.query(sql, [userId]);
}

module.exports = {
  createChallenge,
  findLatestUnconsumedSignupChallenge,
  findLatestUnconsumedRecoveryChallenge,
  incrementAttempts,
  consumeChallenge,
  consumeOlderSignupChallenges,
  consumeOlderRecoveryChallenges,
  getRecentResendCount,
  getLatestChallenge,
};