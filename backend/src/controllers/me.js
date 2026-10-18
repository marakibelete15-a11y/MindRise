'use strict';

// Account, profile, avatar, and settings request handlers. SRS FR-1.3, FR-1.7, FR-5.2, FR-5.4.
const profileService = require('../services/profileService');
const avatarStorage = require('../services/avatarStorage');
const AppError = require('../utils/AppError');

/**
 * Gets current authenticated user details, profile, and settings.
 * GET /api/me
 */
async function getMe(req, res, next) {
  try {
    const result = await profileService.getMe(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Updates user profile (handle or bio).
 * PATCH /api/me/profile
 */
async function updateProfile(req, res, next) {
  try {
    const result = await profileService.updateProfile(req.user.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Uploads, re-encodes, and updates user avatar.
 * POST /api/me/avatar
 */
async function uploadAvatar(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      throw new AppError(400, 'VALIDATION_ERROR', 'No image file uploaded.');
    }
    const result = await profileService.uploadAvatar(req.user.id, req.file.buffer);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Gets user settings.
 * GET /api/me/settings
 */
async function getSettings(req, res, next) {
  try {
    const result = await profileService.getSettings(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Updates user settings.
 * PATCH /api/me/settings
 */
async function updateSettings(req, res, next) {
  try {
    const result = await profileService.updateSettings(req.user.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Serves an avatar image safely.
 * GET /api/avatars/:file
 * Blocks path traversal, sends nosniff, and sets cache-control.
 */
function getAvatarFile(req, res, next) {
  try {
    const filename = req.params.file;
    const resolvedPath = avatarStorage.resolve(filename);

    if (!resolvedPath) {
      throw new AppError(404, 'NOT_FOUND', 'Avatar not found.');
    }

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(resolvedPath);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMe,
  updateProfile,
  uploadAvatar,
  getSettings,
  updateSettings,
  getAvatarFile,
};