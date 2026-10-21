'use strict';

// Account deletion and restoration repository. SRS FR-1.3, FR-5.4.
const pool = require('../config/db');

/**
 * Retrieves the user record with password hash, status, and deleted_at timestamp.
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function getUserSecurityContext(userId, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    SELECT id, status, password_hash, deleted_at
    FROM users
    WHERE id = $1
  `;
  const result = await queryExecutor.query(sql, [userId]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    status: row.status,
    passwordHash: row.password_hash,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  };
}

/**
 * Sets user status to deletion_pending and sets deleted_at to now().
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<Date>} The recorded deleted_at timestamp
 */
async function markDeletionPending(userId, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    UPDATE users
    SET status = 'deletion_pending', deleted_at = now(), updated_at = now()
    WHERE id = $1
    RETURNING deleted_at
  `;
  const result = await queryExecutor.query(sql, [userId]);
  return new Date(result.rows[0].deleted_at);
}

/**
 * Hides all visible posts and comments authored by the user.
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<{ postsHidden: number, commentsHidden: number }>}
 */
async function hideUserContent(userId, client = null) {
  const queryExecutor = client || pool;

  const postResult = await queryExecutor.query(
    `UPDATE community_posts
     SET status = 'hidden', updated_at = now()
     WHERE author_id = $1 AND status = 'visible'`,
    [userId]
  );

  const commentResult = await queryExecutor.query(
    `UPDATE community_comments
     SET status = 'hidden', updated_at = now()
     WHERE author_id = $1 AND status = 'visible'`,
    [userId]
  );

  return {
    postsHidden: postResult.rowCount,
    commentsHidden: commentResult.rowCount,
  };
}

/**
 * Restores user status to active and clears deleted_at.
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<void>}
 */
async function restoreAccountStatus(userId, client = null) {
  const queryExecutor = client || pool;
  await queryExecutor.query(
    `UPDATE users
     SET status = 'active', deleted_at = NULL, updated_at = now()
     WHERE id = $1`,
    [userId]
  );
}

/**
 * Restores hidden posts and comments authored by the user that were hidden during deletion.
 *
 * @param {string} userId
 * @param {Date} deletionTimestamp
 * @param {object} [client]
 * @returns {Promise<{ postsRestored: number, commentsRestored: number }>}
 */
async function restoreUserContent(userId, deletionTimestamp, client = null) {
  const queryExecutor = client || pool;

  const postResult = await queryExecutor.query(
    `UPDATE community_posts
     SET status = 'visible', updated_at = now()
     WHERE author_id = $1 AND status = 'hidden' AND updated_at >= $2`,
    [userId, deletionTimestamp]
  );

  const commentResult = await queryExecutor.query(
    `UPDATE community_comments
     SET status = 'visible', updated_at = now()
     WHERE author_id = $1 AND status = 'hidden' AND updated_at >= $2`,
    [userId, deletionTimestamp]
  );

  return {
    postsRestored: postResult.rowCount,
    commentsRestored: commentResult.rowCount,
  };
}

module.exports = {
  getUserSecurityContext,
  markDeletionPending,
  hideUserContent,
  restoreAccountStatus,
  restoreUserContent,
};
