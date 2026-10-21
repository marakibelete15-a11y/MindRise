#!/usr/bin/env node
'use strict';

// Scheduled retention cleanup entry point. SRS 5.4, FR-5.4, FR-7.x.
const retentionService = require('../src/services/retentionService');

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const dryRun = args.includes('--dry-run') || !execute;

async function run() {
  if (dryRun) {
    console.log('Cleanup dry run: no records will be changed.');
  } else {
    console.log('Cleanup execution mode: applying retention policies.');
  }

  const results = await retentionService.cleanup({
    execute: !dryRun,
    now: new Date(),
  });

  console.log(JSON.stringify(results, null, 2));
}

run().catch((err) => {
  console.error('Retention cleanup failed:', err);
  process.exit(1);
});