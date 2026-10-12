'use strict';

// Tests standard JSON errors for unknown routes and server failures. SRS API conventions. TODO: cover mapped PostgreSQL errors.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const notFound = require('../src/middleware/notFound');
const errorHandler = require('../src/middleware/errorHandler');

const app = express();
app.get('/throw', () => { throw new Error('private stack detail'); });
app.use(notFound);
app.use(errorHandler);

test('unknown route returns JSON 404', async () => {
  const response = await request(app).get('/unknown');
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: { code: 'NOT_FOUND', message: 'Route not found.' } });
});

test('thrown error returns JSON 500 without stack details', async () => {
  const response = await request(app).get('/throw');
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
  assert.equal(JSON.stringify(response.body).includes('private stack detail'), false);
});