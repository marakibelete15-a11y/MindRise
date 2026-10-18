'use strict';

// Per-user notification queries. SRS FR-5.x.
const pool = require('../config/db');

/**
 * Creates an in-app notification.
 * SRS FR-5.x.
 *
 * @param {object} data
 * @param {string} data.userId
 * @param {string} data.type
 * @param {string} data.title
 * @param {string} data.body
 * @param {object} [data.payload={}]
 * @param {object} [client]
 * @returns {Promise<object>} Created notification
 */
async function createNotification(data, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    INSERT INTO notifications (user_id, notification_type, title, body, payload)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      user_id AS "userId",
      notification_type AS type,
      title,
      body,
      payload,
      read_at AS "readAt",
      created_at AS "createdAt"
  `;
  const values = [
    data.userId,
    data.type,
    data.title,
    data.body,
    JSON.stringify(data.payload || {}),
  ];
  const result = await queryExecutor.query(sql, values);
  return result.rows[0];
}

/**
 * Lists notifications for a user with cursor pagination and unread count.
 * SRS FR-5.x.
 * IDOR Defense: Enforces user_id = $1.
 *
 * @param {string} userId
 * @param {object} [options]
 * @param {string|null} [options.cursor]
 * @param {number} [options.limit=20]
 * @param {object} [client]
 * @returns {Promise<{ items: Array, nextCursor: string|null, unreadCount: number }>}
 */
async function getNotificationsByUser(userId, options = {}, client = null) {
  const queryExecutor = client || pool;
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const cursor = options.cursor ? new Date(options.cursor) : null;

  let sql;
  let params;

  if (cursor && !isNaN(cursor.getTime())) {
    sql = `
      SELECT
        id,
        notification_type AS type,
        title,
        body,
        payload,
        read_at AS "readAt",
        created_at AS "createdAt"
      FROM notifications
      WHERE user_id = $1 AND created_at < $2
      ORDER BY created_at DESC
      LIMIT $3
    `;
    params = [userId, cursor, limit + 1];
  } else {
    sql = `
      SELECT
        id,
        notification_type AS type,
        title,
        body,
        payload,
        read_at AS "readAt",
        created_at AS "createdAt"
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    params = [userId, limit + 1];
  }

  const result = await queryExecutor.query(sql, params);
  const rows = result.rows;
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].createdAt.toISOString() : null;

  // Compute unread count
  const countRes = await queryExecutor.query(
    'SELECT count(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
    [userId]
  );
  const unreadCount = countRes.rows[0]?.count ?? 0;

  return {
    items,
    nextCursor,
    unreadCount,
  };
}

/**
 * Marks a specific notification as read.
 * SRS FR-5.x.
 * IDOR Defense: Enforces user_id = $2. Returns null if not owned by user.
 *
 * @param {string} userId
 * @param {string} notificationId
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function markAsRead(userId, notificationId, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    UPDATE notifications
    SET read_at = now()
    WHERE id = $1 AND user_id = $2
    RETURNING id, read_at AS "readAt"
  `;
  const result = await queryExecutor.query(sql, [notificationId, userId]);
  return result.rows[0] || null;
}

/**
 * Marks all unread notifications for a user as read.
 * SRS FR-5.x.
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<number>} Number of marked notifications
 */
async function markAllAsRead(userId, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    UPDATE notifications
    SET read_at = now()
    WHERE user_id = $1 AND read_at IS NULL
  `;
  const result = await queryExecutor.query(sql, [userId]);
  return result.rowCount || 0;
}

module.exports = {
  createNotification,
  getNotificationsByUser,
  markAsRead,
  markAllAsRead,
};