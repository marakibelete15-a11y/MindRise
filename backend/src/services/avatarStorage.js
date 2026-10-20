'use strict';

// Avatar storage service interface. SRS FR-1.3, FR-1.7.
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const env = require('../config/env');

const AVATAR_DIR = path.resolve(env.uploadDir);
const FILENAME_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i;

// Ensure upload directory exists synchronously on startup
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

/**
 * Saves an avatar buffer to disk.
 *
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {Promise<string>} Relative path stored in database
 */
async function save(buffer, filename) {
  if (!FILENAME_REGEX.test(filename)) {
    throw new Error('Invalid avatar filename format.');
  }

  const destination = path.resolve(AVATAR_DIR, filename);
  if (!destination.startsWith(AVATAR_DIR + path.sep)) {
    throw new Error('Path traversal attempt detected.');
  }

  await fsPromises.writeFile(destination, buffer);
  return path.join('uploads/avatars', filename);
}

/**
 * Removes an avatar file from disk.
 *
 * @param {string|null} relativePath
 * @returns {Promise<void>}
 */
async function remove(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') return;

  const filename = path.basename(relativePath);
  if (!FILENAME_REGEX.test(filename)) return;

  const resolved = path.resolve(AVATAR_DIR, filename);
  if (!resolved.startsWith(AVATAR_DIR + path.sep)) {
    return;
  }

  try {
    await fsPromises.unlink(resolved);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Failed to unlink previous avatar:', relativePath);
    }
  }
}

/**
 * Resolves an avatar filename to an absolute filesystem path.
 * Strictly validates filename pattern and ensures path stays within avatar directory.
 *
 * @param {string} filename
 * @returns {string|null} Absolute path or null if invalid or nonexistent
 */
function resolve(filename) {
  if (!filename || typeof filename !== 'string' || !FILENAME_REGEX.test(filename)) {
    return null;
  }

  const absolutePath = path.resolve(AVATAR_DIR, filename);
  if (!absolutePath.startsWith(AVATAR_DIR + path.sep)) {
    return null;
  }

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return absolutePath;
}

/**
 * Checks whether an avatar file exists on disk given its relative path.
 *
 * @param {string|null} relativePath
 * @returns {boolean}
 */
function exists(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') return false;

  const filename = path.basename(relativePath);
  if (!FILENAME_REGEX.test(filename)) return false;

  const resolved = path.resolve(AVATAR_DIR, filename);
  if (!resolved.startsWith(AVATAR_DIR + path.sep)) {
    return false;
  }

  return fs.existsSync(resolved);
}

module.exports = {
  save,
  remove,
  resolve,
  exists,
  AVATAR_DIR,
};