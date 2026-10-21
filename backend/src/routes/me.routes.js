'use strict';

// Account, profile, avatar, settings, and me-notification routes. SRS FR-1.3, FR-1.7, FR-5.2, FR-5.4.
const express = require('express');
const meController = require('../controllers/me');
const notificationController = require('../controllers/notification');
const requireAuth = require('../middleware/requireAuth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { updateProfileSchema, updateSettingsSchema, deleteAccountSchema } = require('../validators/me.schemas');

const router = express.Router();

router.get('/me', requireAuth, meController.getMe);
router.patch('/me/profile', requireAuth, validate(updateProfileSchema), meController.updateProfile);
router.post('/me/avatar', requireAuth, upload, meController.uploadAvatar);
router.get('/me/settings', requireAuth, meController.getSettings);
router.patch('/me/settings', requireAuth, validate(updateSettingsSchema), meController.updateSettings);
router.delete('/me', requireAuth, validate(deleteAccountSchema), meController.deleteMe);
router.post('/me/restore', requireAuth({ allowDeletionPending: true }), meController.restoreMe);

// Public avatar image serving (path traversal protected, cache-control, nosniff)
router.get('/avatars/:file', meController.getAvatarFile);

// Notifications mounted under /me/notifications
router.get('/me/notifications', requireAuth, notificationController.listNotifications);
router.post('/me/notifications/:id/read', requireAuth, notificationController.markNotificationRead);
router.patch('/me/notifications/:id/read', requireAuth, notificationController.markNotificationRead);
router.post('/me/notifications/read-all', requireAuth, notificationController.markAllNotificationsRead);

module.exports = router;