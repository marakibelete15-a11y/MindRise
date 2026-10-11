'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const migrationDirectory = path.resolve(__dirname, '../../database/migrations');
const pool = require('../src/config/db');

async function runMigrations() {
  const files = (await fs.readdir(migrationDirectory))
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
      await client.query('BEGIN');
      try {
        await client.query("SELECT pg_advisory_xact_lock(hashtext('mindrise:database:migrations'))");
        const alreadyApplied = await client.query(
          'SELECT 1 FROM schema_migrations WHERE filename = $1',
          [filename],
        );

        if (alreadyApplied.rowCount > 0) {
          await client.query('COMMIT');
          continue;
        }

        const sql = await fs.readFile(path.join(migrationDirectory, filename), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        console.log(`Applied ${filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${filename} failed: ${error.message}`, { cause: error });
      }
    }
  } finally {
    client.release();
  }
}

runMigrations()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());