'use strict';

process.env.NODE_ENV = 'test';

// Test entrypoint for node --test tests/. SRS API conventions.
require('./health.test');
require('./errors.test');
require('./tokens.test');
require('./crypto.test');
require('./middleware.test');
require('./identity-privacy.test');
require('./auth.test');
require('./stage3.test');

const test = require('node:test');
const db = require('./helpers/db');

test.after(async () => {
  await db.cleanup();
  await db.endPool();
});