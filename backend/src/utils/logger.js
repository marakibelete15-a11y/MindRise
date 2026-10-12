'use strict';

// Redacted structured logging. SRS 5.4. TODO: redact bodies, OTPs, tokens, and identity fields.
const pino = require('pino');

module.exports = pino({ redact: ['body', 'req.body', 'otp', 'token', 'authorization', 'email', 'phone', 'first_name', 'last_name', 'password'] });