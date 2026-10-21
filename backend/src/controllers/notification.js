'use strict';

// Notification request handlers. SRS FR-5.x.
const notificationService = require('../services/notificationService');

/**
 * Lists user notifications.
 * GET /api/me/notifications
 */
async function listNotifications(req, res, next) {
  try {
    const result = await notificationService.list(req.user.id, {
      cursor: req.query.cursor,
      limit: req.query.limit,
    });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Marks a specific notification as read.
 * POST /api/me/notifications/:id/read or PATCH /api/me/notifications/:id/read
 */
async function markNotificationRead(req, res, next) {
  try {
    const notificationId = req.params.id || req.params.notificationId;
    const result = await notificationService.markRead(req.user.id, notificationId);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Marks all notifications as read.
 * POST /api/me/notifications/read-all
 */
async function markAllNotificationsRead(req, res, next) {
  try {
    const result = await notificationService.markAllRead(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};