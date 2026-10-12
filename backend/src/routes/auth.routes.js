'use strict';

// Planned: POST /auth/register, /auth/verify, /auth/resend-code, /auth/login, /auth/recover/request, /auth/recover/confirm. SRS FR-1.1, 1.2, 1.8. TODO: register handlers.
const express = require('express');

module.exports = express.Router();