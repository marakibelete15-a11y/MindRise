'use strict';

// Notification routes. SRS FR-5.x.
const express = require('express');
const notificationController = require('../controllers/notification');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/notifications', requireAuth, notificationController.listNotifications);
router.patch('/notifications/:id/read', requireAuth, notificationController.markNotificationRead);
router.post('/notifications/:id/read', requireAuth, notificationController.markNotificationRead);
router.post('/notifications/read-all', requireAuth, notificationController.markAllNotificationsRead);

module.exports = router;