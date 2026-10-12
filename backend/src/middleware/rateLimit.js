'use strict';

// Rate-limit configuration placeholder. SRS FR-1.x, FR-4.x, FR-7.5. TODO: configure route-specific policies.
const rateLimit = require('express-rate-limit');

module.exports = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });