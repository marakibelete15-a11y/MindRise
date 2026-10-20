'use strict';

const multer = require('multer');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: env.maxAvatarBytes,
  },
});

function avatarUpload(req, res, next) {
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new AppError(
            400,
            'VALIDATION_ERROR',
            `Avatar file exceeds maximum size of ${Math.round(env.maxAvatarBytes / (1024 * 1024))}MB.`
          )
        );
      }
      return next(new AppError(400, 'VALIDATION_ERROR', err.message || 'File upload failed.'));
    }
    return next();
  });
}

module.exports = avatarUpload;