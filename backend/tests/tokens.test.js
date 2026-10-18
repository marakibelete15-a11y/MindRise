'use strict';

process.env.NODE_ENV = 'test';

// Token unit and security tests. SRS 2.7, FR-1.1.
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { signAccessToken, verifyAccessToken } = require('../src/utils/tokens');
const env = require('../src/config/env');
const AppError = require('../src/utils/AppError');

test('tokens: valid token signs and verifies claims', () => {
  const user = {
    id: '00000000-0000-4000-8000-000000000001',
    role: 'youth',
    alias: 'secret_alias',
    email: 'secret@example.com',
    first_name: 'Secret',
    last_name: 'Name',
  };

  const token = signAccessToken(user);
  assert.equal(typeof token, 'string');

  const claims = verifyAccessToken(token);
  assert.equal(claims.sub, user.id);
  assert.equal(claims.role, user.role);

  // Hard privacy rule: No names, contact data, or handle in token payload
  const decodedRaw = jwt.decode(token);
  assert.equal(decodedRaw.alias, undefined);
  assert.equal(decodedRaw.email, undefined);
  assert.equal(decodedRaw.phone, undefined);
  assert.equal(decodedRaw.first_name, undefined);
  assert.equal(decodedRaw.last_name, undefined);
});

test('tokens: expired token throws 401 INVALID_TOKEN', () => {
  const expiredToken = jwt.sign(
    { sub: '00000000-0000-4000-8000-000000000001', role: 'youth' },
    env.jwtSecret,
    { algorithm: 'HS256', expiresIn: -10 }
  );

  assert.throws(
    () => verifyAccessToken(expiredToken),
    (err) => err instanceof AppError && err.statusCode === 401 && err.publicCode === 'INVALID_TOKEN'
  );
});

test('tokens: token signed with wrong secret throws 401 INVALID_TOKEN', () => {
  const wrongSecretToken = jwt.sign(
    { sub: '00000000-0000-4000-8000-000000000001', role: 'youth' },
    'wrong-secret-that-does-not-match-env-secret-12345',
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  assert.throws(
    () => verifyAccessToken(wrongSecretToken),
    (err) => err instanceof AppError && err.statusCode === 401 && err.publicCode === 'INVALID_TOKEN'
  );
});

test('tokens: alg none token is strictly rejected', () => {
  // Craft an unverified token with alg: none
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: '00000000-0000-4000-8000-000000000001', role: 'admin' })).toString('base64url');
  const algNoneToken = `${header}.${payload}.`;

  assert.throws(
    () => verifyAccessToken(algNoneToken),
    (err) => err instanceof AppError && err.statusCode === 401 && err.publicCode === 'INVALID_TOKEN'
  );
});

test('tokens: tampered token throws 401 INVALID_TOKEN', () => {
  const user = { id: '00000000-0000-4000-8000-000000000001', role: 'youth' };
  const validToken = signAccessToken(user);

  // Tamper with payload
  const parts = validToken.split('.');
  const tamperedPayload = Buffer.from(
    JSON.stringify({ sub: user.id, role: 'admin' })
  ).toString('base64url');
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

  assert.throws(
    () => verifyAccessToken(tamperedToken),
    (err) => err instanceof AppError && err.statusCode === 401 && err.publicCode === 'INVALID_TOKEN'
  );
});
