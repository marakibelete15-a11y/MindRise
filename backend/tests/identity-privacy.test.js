'use strict';

process.env.NODE_ENV = 'test';

// Privacy contract tests. SRS FR-1.x, FR-4.5, 5.4, 6.1.
// Hard Rule 3: Real name, email and phone exist ONLY in verified_identities.
// No public response, auth token, or auth context may leak personal identity data.

const test = require('node:test');
const assert = require('node:assert/strict');
const userRepository = require('../src/repositories/userRepository');
const serializers = require('../src/utils/serializers');
const { signAccessToken } = require('../src/utils/tokens');
const jwt = require('jsonwebtoken');

const db = require('./helpers/db');
const authHelper = require('./helpers/auth');

test('privacy: findAuthContextById never returns real names, email, phone, or password', async () => {
  const user = await authHelper.createTestUser({ role: 'youth', verified: true });
  const authContext = await userRepository.findAuthContextById(user.id);

  assert.ok(authContext);
  assert.equal(authContext.id, user.id);
  assert.equal(authContext.role, 'youth');
  assert.equal(authContext.status, 'active');
  assert.equal(authContext.verified, true);

  // Assert strictly forbidden identity keys are NOT returned
  const forbiddenKeys = [
    'first_name',
    'last_name',
    'email',
    'phone',
    'password',
    'password_hash',
    'firstName',
    'lastName',
    'alias',
  ];

  for (const key of forbiddenKeys) {
    assert.equal(
      authContext[key],
      undefined,
      `findAuthContextById must not return private identity key: ${key}`
    );
  }
});

test('privacy: serializers.publicProfile never exposes PII', () => {
  const dirtyProfile = {
    alias: 'peaceful_youth',
    avatarUrl: 'https://example.test/avatar.webp',
    first_name: 'RealFirst',
    last_name: 'RealLast',
    email: 'real@example.test',
    phone: '+251911223344',
    user_id: '00000000-0000-4000-8000-000000000001',
  };

  const serialized = serializers.publicProfile(dirtyProfile);
  assert.deepEqual(serialized, {
    alias: 'peaceful_youth',
    avatarUrl: 'https://example.test/avatar.webp',
  });
  assert.equal(serialized.first_name, undefined);
  assert.equal(serialized.email, undefined);
  assert.equal(serialized.phone, undefined);
});

test('privacy: signAccessToken never includes real names, email, phone, or alias in claims', () => {
  const dirtyUser = {
    id: '00000000-0000-4000-8000-000000000001',
    role: 'youth',
    alias: 'youth_alias',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.test',
    phone: '+251900000000',
  };

  const token = signAccessToken(dirtyUser);
  const claims = jwt.decode(token);

  assert.equal(claims.sub, dirtyUser.id);
  assert.equal(claims.role, 'youth');
  assert.equal(claims.first_name, undefined);
  assert.equal(claims.last_name, undefined);
  assert.equal(claims.email, undefined);
  assert.equal(claims.phone, undefined);
  assert.equal(claims.alias, undefined);
});

test.after(async () => {
  await db.cleanup();
});