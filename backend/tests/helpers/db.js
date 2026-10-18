'use strict';

// Test database management helper for integration tests.
// SRS 5.4, 6.1. Hard Rule 6: Tests MUST run against a database ending in _test.
// This helper refuses to run against any non-_test database and tracks created rows
// to clean them up without dropping or affecting seed/dev data.

const { Pool } = require('pg');
const fs = require('node:fs/promises');
const path = require('node:path');

// Guarantee test environment
process.env.NODE_ENV = 'test';

const testDbName = process.env.TEST_DB_NAME || 'mindrise_test';

// Hard Rule 6: Refuse non-_test database names
if (!testDbName.endsWith('_test')) {
  throw new Error(`Database name '${testDbName}' is invalid. Test database must end with '_test' to prevent test data pollution.`);
}

// In standard sandbox environments, connecting via /tmp socket avoids TCP isolation
const testDbHost = process.env.TEST_DB_HOST || '/tmp';
const testDbPort = Number(process.env.TEST_DB_PORT || process.env.DB_PORT || 5432);

const pool = new Pool({
  host: testDbHost,
  port: testDbPort,
  database: testDbName,
  user: process.env.TEST_DB_USER || process.env.DB_USER,
  password: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD,
});

pool.on('error', (err) => {
  console.error('Test DB pool error:', err.message);
});

// Track created user IDs for targeted, safe cleanup
const trackedUserIds = new Set();

/**
 * Registers a created user ID to be deleted during cleanup().
 * @param {string} userId - UUID of created user
 */
function trackUser(userId) {
  if (userId) {
    trackedUserIds.add(userId);
  }
}

/**
 * Cleans up all rows created during the test run.
 * Deleting from users cascades to verified_identities, profiles, user_settings, etc.
 */
async function cleanup() {
  if (trackedUserIds.size === 0) return;
  const ids = Array.from(trackedUserIds);
  await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);
  trackedUserIds.clear();
}

/**
 * Runs pending migrations on TEST_DB_NAME if needed.
 */
async function ensureMigrations() {
  const migrationDir = path.resolve(__dirname, '../../../database/migrations');
  const files = (await fs.readdir(migrationDir))
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort();

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const filename of files) {
      const alreadyApplied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [filename]
      );
      if (alreadyApplied.rowCount > 0) continue;

      const sql = await fs.readFile(path.join(migrationDir, filename), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Test migration ${filename} failed: ${err.message}`, { cause: err });
      }
    }
  } finally {
    client.release();
  }
}

/**
 * Closes the database pool connections.
 */
async function endPool() {
  if (pool.ending || pool.ended) {
    return;
  }
  await pool.end();
}

module.exports = {
  pool,
  query: pool.query.bind(pool),
  trackUser,
  cleanup,
  ensureMigrations,
  endPool,
  testDbName,
};
