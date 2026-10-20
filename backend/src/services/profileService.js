'use strict';

// Profile and settings business rules. SRS FR-1.3, FR-1.7, FR-5.2, 5.4.
const crypto = require('node:crypto');
const path = require('node:path');
const sharp = require('sharp');
const AppError = require('../utils/AppError');
const userRepository = require('../repositories/userRepository');
const profileRepository = require('../repositories/profileRepository');
const avatarStorage = require('./avatarStorage');

/**
 * Validates file buffer magic bytes for JPEG, PNG, or WebP.
 *
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isValidImageBytes(buffer) {
  if (!buffer || buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return true;
  }

  // WebP: 'RIFF' .... 'WEBP'
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return true;
  }

  return false;
}

/**
 * Resolves avatar URL from stored relative path.
 * If file does not exist on disk, logs relative path and returns null.
 *
 * @param {string|null} avatarPath
 * @returns {string|null}
 */
function resolveAvatarUrl(avatarPath) {
  if (!avatarPath) return null;
  if (avatarStorage.exists(avatarPath)) {
    return `/api/avatars/${path.basename(avatarPath)}`;
  }
  // Missing file on disk: log relative path only (never full disk path)
  console.warn(`[Avatar] File not found on disk: ${avatarPath}`);
  return null;
}

/**
 * Loads current user's profile, status, and settings.
 * SRS FR-1.3, FR-1.7, FR-5.2.
 * HARD PRIVACY: Never leaks real names, email, phone, or password.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getMe(userId) {
  const user = await userRepository.findAuthContextById(userId);
  if (!user) {
    throw new AppError(401, 'INVALID_TOKEN', 'User not found.');
  }

  const profile = await profileRepository.findByUserId(userId);
  const settings = await userRepository.getUserSettings(userId);

  const avatarUrl = resolveAvatarUrl(profile?.avatar_path);

  return {
    id: user.id,
    handle: profile?.alias || null,
    avatarUrl,
    bio: profile?.bio || null,
    role: user.role,
    status: user.status,
    verified: Boolean(user.verified),
    settings: settings || {
      language: 'en',
      timezone: 'Africa/Addis_Ababa',
      pushEnabled: true,
      emailEnabled: false,
      profileVisibility: 'anonymous',
    },
  };
}

/**
 * Updates public profile (handle or bio).
 * SRS FR-1.7.
 *
 * @param {string} userId
 * @param {object} input
 * @param {string} [input.handle]
 * @param {string|null} [input.bio]
 * @returns {Promise<object>}
 */
async function updateProfile(userId, input) {
  if (input.handle) {
    const existing = await profileRepository.findByAlias(input.handle);
    if (existing && existing.user_id !== userId) {
      throw new AppError(409, 'HANDLE_TAKEN', 'That handle is already taken. Please choose another.');
    }
  }

  const updated = await profileRepository.updateProfile(userId, {
    alias: input.handle,
    bio: input.bio,
  });

  if (!updated) {
    throw new AppError(404, 'NOT_FOUND', 'Profile not found.');
  }

  const avatarUrl = resolveAvatarUrl(updated.avatar_path);

  return {
    handle: updated.alias,
    avatarUrl,
    bio: updated.bio || null,
  };
}

/**
 * Validates, re-encodes, and saves a user avatar image.
 * SRS FR-1.3, FR-1.7, 5.4.
 *
 * @param {string} userId
 * @param {Buffer} fileBuffer
 * @returns {Promise<{ avatarUrl: string }>}
 */
async function uploadAvatar(userId, fileBuffer) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'No image file provided.');
  }

  if (!isValidImageBytes(fileBuffer)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Invalid image format. Only JPEG, PNG, and WebP images are allowed.'
    );
  }

  let webpBuffer;
  try {
    // Re-encoding to WebP strips EXIF metadata (GPS, camera info) and removes payloads
    webpBuffer = await sharp(fileBuffer)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (err) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid or corrupt image file.');
  }

  const filename = `${crypto.randomUUID()}.webp`;
  const relativePath = await avatarStorage.save(webpBuffer, filename);

  const currentProfile = await profileRepository.findByUserId(userId);
  await profileRepository.updateProfile(userId, { avatarPath: relativePath });

  // Delete previous avatar file after DB update commits
  if (currentProfile?.avatar_path) {
    await avatarStorage.remove(currentProfile.avatar_path);
  }

  return {
    avatarUrl: `/api/avatars/${filename}`,
  };
}

/**
 * Gets user settings.
 * SRS FR-5.2.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getSettings(userId) {
  const settings = await userRepository.getUserSettings(userId);
  if (!settings) {
    throw new AppError(404, 'NOT_FOUND', 'Settings not found.');
  }
  return settings;
}

/**
 * Updates user settings.
 * SRS FR-5.2.
 *
 * @param {string} userId
 * @param {object} input
 * @returns {Promise<object>}
 */
async function updateSettings(userId, input) {
  const updated = await userRepository.updateUserSettings(userId, input);
  if (!updated) {
    throw new AppError(404, 'NOT_FOUND', 'Settings not found.');
  }
  return updated;
}

module.exports = {
  getMe,
  updateProfile,
  uploadAvatar,
  getSettings,
  updateSettings,
  resolveAvatarUrl,
  isValidImageBytes,
};