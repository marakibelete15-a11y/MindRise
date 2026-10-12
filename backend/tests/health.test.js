'use strict';

// Tests the health endpoint response when the database check succeeds. SRS 5.4. TODO: add configured database integration coverage.
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const healthRepository = require('../src/repositories/healthRepository');

test('GET /api/health returns 200 when the database is up', async () => {
  const originalCheck = healthRepository.check;
  healthRepository.check = async () => ({ rows: [{ '?column?': 1 }] });
  try {
    const response = await request(app).get('/api/health');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { status: 'ok', database: 'connected' });
  } finally {
    healthRepository.check = originalCheck;
  }
});