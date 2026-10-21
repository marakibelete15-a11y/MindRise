
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');

test('GET /api/community/spaces returns community spaces', async () => {
  const response = await request(app)
    .get('/api/community/spaces');

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.spaces));
});

test('GET /api/community/posts returns a paginated feed', async () => {
  const response = await request(app)
    .get('/api/community/posts?limit=10&offset=0');

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.posts));
});

test('Community feed rejects invalid pagination', async () => {
  const response = await request(app)
    .get('/api/community/posts?limit=-1');

  assert.equal(response.status, 400);
});

test('Missing community post returns 404', async () => {
  const response = await request(app)
    .get('/api/community/posts/11111111-1111-4111-8111-111111111111');

  assert.equal(response.status, 404);
});
