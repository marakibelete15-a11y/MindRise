'use strict';

// Avatar upload middleware placeholder. SRS FR-1.3, 5.4. TODO: validate image type, size, and storage path.
const multer = require('multer');

module.exports = multer({ storage: multer.memoryStorage() });