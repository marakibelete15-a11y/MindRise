'use strict';

// Planned: GET /me, PATCH /me/profile, POST /me/avatar, GET/PATCH /me/settings, DELETE /me. SRS FR-1.3, 1.7, 5.2, 5.4. TODO: register handlers.
const express = require('express');

module.exports = express.Router();