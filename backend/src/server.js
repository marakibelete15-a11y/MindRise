'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const env = require('./config/env');
const app = require('./app');
const healthRepository = require('./repositories/healthRepository');

const server = app.listen(env.port, () => {
  console.log(`MindRise backend listening on port ${env.port}`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down.`);
  server.close(async (error) => {
    if (error) console.error('HTTP server shutdown error:', error.message);
    await healthRepository.endPool();
    process.exitCode = error ? 1 : 0;
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));