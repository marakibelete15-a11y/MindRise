'use strict';

process.env.NODE_ENV = 'test';

// Middleware unit and integration tests.
// SRS FR-1.1, FR-1.2, FR-7.1, FR-7.2, FR-7.5.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { z } = require('zod');
const jwt = require('jsonwebtoken');

const env = require('../src/config/env');
const requireAuth = require('../src/middleware/requireAuth');
const requireRole = require('../src/middleware/requireRole');
const requireVerified = require('../src/middleware/requireVerified');
const notRestricted = require('../src/middleware/notRestricted');
const validate = require('../src/middleware/validate');
const errorHandler = require('../src/middleware/errorHandler');

const db = require('./helpers/db');
const authHelper = require('./helpers/auth');

function createTestApp() {
  const app = express();
  app.use(express.json());

  // Test endpoints
  app.get('/test/auth', requireAuth, (req, res) => {
    res.json({ status: 'ok', user: req.user });
  });

  app.get('/test/auth-deletion', requireAuth({ allowDeletionPending: true }), (req, res) => {
    res.json({ status: 'ok', user: req.user });
  });

  app.get('/test/role-mod-admin', requireAuth, requireRole('moderator', 'admin'), (req, res) => {
    res.json({ status: 'ok', role: req.user.role });
  });

  app.get('/test/verified-only', requireAuth, requireVerified, (_req, res) => {
    res.json({ status: 'ok', verified: true });
  });

  app.post('/test/not-restricted', requireAuth, notRestricted, (_req, res) => {
    res.json({ status: 'ok', posted: true });
  });

  const testSchema = {
    body: z.object({
      title: z.string().min(3),
      score: z.number().int().optional(),
    }),
  };

  app.post('/test/validate', validate(testSchema), (req, res) => {
    res.json({ status: 'ok', body: req.body });
  });

  app.use(errorHandler);
  return app;
}

const app = createTestApp();

test('requireAuth: missing or malformed Authorization header returns 401', async () => {
  // Missing header
  const res1 = await request(app).get('/test/auth');
  assert.equal(res1.status, 401);
  assert.equal(res1.body.error.code, 'INVALID_TOKEN');

  // Not Bearer
  const res2 = await request(app).get('/test/auth').set('Authorization', 'Basic 12345');
  assert.equal(res2.status, 401);
  assert.equal(res2.body.error.code, 'INVALID_TOKEN');

  // Empty token
  const res3 = await request(app).get('/test/auth').set('Authorization', 'Bearer ');
  assert.equal(res3.status, 401);
  assert.equal(res3.body.error.code, 'INVALID_TOKEN');
});

test('requireAuth: invalid or forged token returns 401', async () => {
  const res = await request(app).get('/test/auth').set('Authorization', 'Bearer invalid.token.payload');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_TOKEN');
});

test('requireAuth: active user succeeds and role is taken from database not token', async () => {
  const user = await authHelper.createTestUser({ role: 'youth', verified: true });

  // Forged token claiming to be admin
  const forgedToken = jwt.sign(
    { sub: user.id, role: 'admin' },
    env.jwtSecret,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  const res = await request(app)
    .get('/test/auth')
    .set('Authorization', `Bearer ${forgedToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.user.id, user.id);
  assert.equal(res.body.user.role, 'youth'); // Must be youth from DB, not admin from token!
  assert.equal(res.body.user.verified, true);
  assert.equal(res.body.user.status, 'active');
});

test('requireAuth: unverified user is allowed through requireAuth', async () => {
  const user = await authHelper.createTestUser({ role: 'youth', verified: false });
  const token = authHelper.makeToken(user);

  const res = await request(app)
    .get('/test/auth')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.user.verified, false);
});

test('requireAuth: suspended or banned account returns 403 ACCOUNT_SUSPENDED', async () => {
  const suspendedUser = await authHelper.createTestUser({ status: 'suspended' });
  const suspendedToken = authHelper.makeToken(suspendedUser);

  const res1 = await request(app)
    .get('/test/auth')
    .set('Authorization', `Bearer ${suspendedToken}`);
  assert.equal(res1.status, 403);
  assert.equal(res1.body.error.code, 'ACCOUNT_SUSPENDED');

  const bannedUser = await authHelper.createTestUser({ status: 'banned' });
  const bannedToken = authHelper.makeToken(bannedUser);

  const res2 = await request(app)
    .get('/test/auth')
    .set('Authorization', `Bearer ${bannedToken}`);
  assert.equal(res2.status, 403);
  assert.equal(res2.body.error.code, 'ACCOUNT_SUSPENDED');
});

test('requireAuth: deletion_pending account is blocked unless allowDeletionPending is true', async () => {
  const deletingUser = await authHelper.createTestUser({ status: 'deletion_pending' });
  const token = authHelper.makeToken(deletingUser);

  // Standard endpoint: rejected
  const res1 = await request(app)
    .get('/test/auth')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res1.status, 403);
  assert.equal(res1.body.error.code, 'ACCOUNT_DELETION_PENDING');

  // Deletion-allowed endpoint: accepted
  const res2 = await request(app)
    .get('/test/auth-deletion')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res2.status, 200);
  assert.equal(res2.body.user.id, deletingUser.id);
  assert.equal(res2.body.user.status, 'deletion_pending');
});

test('requireRole: allows authorized roles and returns 403 FORBIDDEN for unauthorized roles', async () => {
  const youthUser = await authHelper.createTestUser({ role: 'youth' });
  const modUser = await authHelper.createTestUser({ role: 'moderator' });
  const adminUser = await authHelper.createTestUser({ role: 'admin' });

  // Youth -> forbidden
  const res1 = await request(app)
    .get('/test/role-mod-admin')
    .set('Authorization', `Bearer ${authHelper.makeToken(youthUser)}`);
  assert.equal(res1.status, 403);
  assert.equal(res1.body.error.code, 'FORBIDDEN');

  // Moderator -> allowed
  const res2 = await request(app)
    .get('/test/role-mod-admin')
    .set('Authorization', `Bearer ${authHelper.makeToken(modUser)}`);
  assert.equal(res2.status, 200);
  assert.equal(res2.body.role, 'moderator');

  // Admin -> allowed
  const res3 = await request(app)
    .get('/test/role-mod-admin')
    .set('Authorization', `Bearer ${authHelper.makeToken(adminUser)}`);
  assert.equal(res3.status, 200);
  assert.equal(res3.body.role, 'admin');
});

test('requireVerified: blocks unverified users with 403 NOT_VERIFIED', async () => {
  const unverifiedUser = await authHelper.createTestUser({ verified: false });
  const verifiedUser = await authHelper.createTestUser({ verified: true });

  const res1 = await request(app)
    .get('/test/verified-only')
    .set('Authorization', `Bearer ${authHelper.makeToken(unverifiedUser)}`);
  assert.equal(res1.status, 403);
  assert.equal(res1.body.error.code, 'NOT_VERIFIED');

  const res2 = await request(app)
    .get('/test/verified-only')
    .set('Authorization', `Bearer ${authHelper.makeToken(verifiedUser)}`);
  assert.equal(res2.status, 200);
  assert.equal(res2.body.verified, true);
});

test('notRestricted: allows unrestricted and past restrictions, blocks future restrictions with 403 and error data', async () => {
  const unrestrictedUser = await authHelper.createTestUser({ restrictedUntil: null });
  const pastRestrictedUser = await authHelper.createTestUser({
    restrictedUntil: new Date(Date.now() - 3600000).toISOString(),
  });
  const futureDate = new Date(Date.now() + 86400000).toISOString();
  const futureRestrictedUser = await authHelper.createTestUser({
    restrictedUntil: futureDate,
  });

  // Null restriction -> allowed
  const res1 = await request(app)
    .post('/test/not-restricted')
    .set('Authorization', `Bearer ${authHelper.makeToken(unrestrictedUser)}`);
  assert.equal(res1.status, 200);

  // Past restriction -> allowed
  const res2 = await request(app)
    .post('/test/not-restricted')
    .set('Authorization', `Bearer ${authHelper.makeToken(pastRestrictedUser)}`);
  assert.equal(res2.status, 200);

  // Future restriction -> blocked with 403 ACCOUNT_RESTRICTED and data.restrictedUntil
  const res3 = await request(app)
    .post('/test/not-restricted')
    .set('Authorization', `Bearer ${authHelper.makeToken(futureRestrictedUser)}`);
  assert.equal(res3.status, 403);
  assert.equal(res3.body.error.code, 'ACCOUNT_RESTRICTED');
  assert.ok(res3.body.error.data);
  assert.equal(res3.body.error.data.restrictedUntil, futureRestrictedUser.restrictedUntil);
});

test('validate: accepts valid body and strips unknown keys', async () => {
  const res = await request(app)
    .post('/test/validate')
    .send({
      title: 'Valid Title',
      score: 10,
      maliciousField: 'ignore_me',
      adminRole: true,
    });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.body, { title: 'Valid Title', score: 10 });
  assert.equal(res.body.body.maliciousField, undefined);
  assert.equal(res.body.body.adminRole, undefined);
});

test('validate: rejects invalid input with 400 VALIDATION_ERROR and field messages', async () => {
  const res = await request(app)
    .post('/test/validate')
    .send({
      title: 'ab', // too short (< 3)
      score: 'not-a-number',
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(res.body.error.details));
  assert.ok(res.body.error.details.length >= 2);

  const fields = res.body.error.details.map((d) => d.field);
  assert.ok(fields.includes('title'));
  assert.ok(fields.includes('score'));
});

// Clean up all rows created by tests
test.after(async () => {
  await db.cleanup();
});
