'use strict';

// Notification service. SRS FR-5.x, 5.4, 6.1.
const AppError = require('../utils/AppError');
const notificationRepository = require('../repositories/notificationRepository');

const FORBIDDEN_NOTIFICATION_KEYS = new Set([
  'firstname',
  'lastname',
  'first_name',
  'last_name',
  'email',
  'phone',
  'password',
  'password_hash',
  'answers',
]);

/**
 * Creates an in-app notification.
 * Available for other parts (wellbeing, moderation) to call.
 * SRS FR-5.x.
 *
 * @param {object} input
 * @param {string} input.userId
 * @param {string} input.type
 * @param {string} input.title
 * @param {string} input.body
 * @param {object} [input.payload={}]
 * @returns {Promise<object>} Created notification
 */
async function create(input) {
  if (!input.userId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'User ID is required for notification.');
  }
  if (!input.title || typeof input.title !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Notification title is required.');
  }
  if (!input.body || typeof input.body !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Notification body is required.');
  }

  const payload = input.payload || {};
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Notification payload must be a plain object.');
  }

  // Hard privacy rule: never store personal identity details in notifications
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_NOTIFICATION_KEYS.has(key.toLowerCase())) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `Notification payload must not contain personal identity data key: ${key}`
      );
    }
  }

  return notificationRepository.createNotification({
    userId: input.userId,
    type: input.type || 'general',
    title: input.title.trim(),
    body: input.body.trim(),
    payload,
  });
}

/**
 * Lists notifications for a user with cursor pagination.
 * SRS FR-5.x.
 *
 * @param {string} userId
 * @param {object} options
 * @returns {Promise<{ items: Array, nextCursor: string|null, unreadCount: number }>}
 */
async function list(userId, options = {}) {
  return notificationRepository.getNotificationsByUser(userId, options);
}

/**
 * Marks a specific notification as read.
 * SRS FR-5.x.
 * IDOR Defense: Returns 404 NOT_FOUND for another user's notification to prevent ID probing.
 *
 * @param {string} userId
 * @param {string} notificationId
 * @returns {Promise<{ id: string, read: boolean }>}
 */
async function markRead(userId, notificationId) {
  const result = await notificationRepository.markAsRead(userId, notificationId);
  if (!result) {
    throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
  }
  return { id: notificationId, read: true };
}

/**
 * Marks all unread notifications for a user as read.
 * SRS FR-5.x.
 *
 * @param {string} userId
 * @returns {Promise<{ success: boolean }>}
 */
async function markAllRead(userId) {
  await notificationRepository.markAllAsRead(userId);
  return { success: true };
}

module.exports = {
  create,
  list,
  markRead,
  markAllRead,
};