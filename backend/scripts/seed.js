'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run test-data seeds when NODE_ENV=production.');
  process.exit(1);
}

const fs = require('node:fs/promises');

const seedDirectory = path.resolve(__dirname, '../../database/seeds');
const pool = require('../src/config/db');

async function runSeeds() {
  const files = (await fs.readdir(seedDirectory))
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  const client = await pool.connect();

  try {
    for (const filename of files) {
      const sql = await fs.readFile(path.join(seedDirectory, filename), 'utf8');
      await client.query(sql);
      console.log(`Applied ${filename}`);
    }
  } finally {
    client.release();
  }
}

runSeeds()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());