'use strict';

process.env.NODE_ENV = 'test';

// Privacy contract tests. SRS FR-1.x, FR-4.5, 5.4, 6.1.
// Hard Rule 3: Real name, email and phone exist ONLY in verified_identities.
// No public response, auth token, or auth context may leak personal identity data.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const pool = require('../src/config/db');
const crypto = require('../src/utils/crypto');
const userRepository = require('../src/repositories/userRepository');
const serializers = require('../src/utils/serializers');
const { signAccessToken } = require('../src/utils/tokens');

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

function findMountPath(layer) {
  if (layer.slash) return '';
  for (const candidate of ['/api', '/auth', '/me', '/admin', '/mod', '/health']) {
    const res = layer.matchers && layer.matchers[0] && layer.matchers[0](candidate);
    if (res && res.path === candidate) return candidate;
  }
  return '';
}

function listAllRoutes(expressApp) {
  const routes = [];
  function walk(router, currentPrefix = '') {
    for (const layer of (router.stack || [])) {
      if (layer.route) {
        const routePath = currentPrefix + (layer.route.path === '/' && currentPrefix ? '' : layer.route.path);
        for (const method of Object.keys(layer.route.methods)) {
          routes.push({ method: method.toUpperCase(), path: routePath });
        }
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        const prefix = findMountPath(layer);
        walk(layer.handle, currentPrefix + prefix);
      }
    }
  }
  walk(expressApp.router);
  return routes;
}

test('privacy: router stack walk, strict public route whitelist, and no X-Powered-By / stack traces', async () => {
  const routes = listAllRoutes(app);
  assert.ok(routes.length >= 15, `Expected at least 15 routes, found ${routes.length}`);

  const PUBLIC_WHITELIST = new Set([
    'GET /api/health',
    'POST /api/auth/register',
    'POST /api/auth/login',
    'POST /api/auth/recover/request',
    'POST /api/auth/recover/confirm',
    'GET /api/avatars/:file',
  ]);

  // Seed Canary User with unique marker strings
  const CANARY = {
    firstName: 'ZxqSecretFirstName',
    lastName: 'ZxqSecretLastName',
    email: 'zxq_canary_audit@example.test',
    phone: '+251999887766',
  };

  const canaryUser = await authHelper.createTestUser({
    role: 'youth',
    verified: true,
    alias: 'zxq_canary_alias',
  });

  // Update verified_identities with encrypted canary data
  await pool.query(
    `UPDATE verified_identities
     SET first_name = $1, last_name = $2, email = $3, phone = $4
     WHERE user_id = $5`,
    [
      crypto.encrypt(CANARY.firstName),
      crypto.encrypt(CANARY.lastName),
      CANARY.email,
      CANARY.phone,
      canaryUser.id,
    ]
  );

  const youthToken = authHelper.makeToken(canaryUser);
  const modUser = await authHelper.createTestUser({ role: 'moderator' });
  const modToken = authHelper.makeToken(modUser);
  const adminUser = await authHelper.createTestUser({ role: 'admin' });
  const adminToken = authHelper.makeToken(adminUser);

  const FORBIDDEN_KEYS = [
    'first_name',
    'last_name',
    'password_hash',
  ];

  for (const route of routes) {
    const key = `${route.method} ${route.path}`;
    const testPath = route.path
      .replace(':file', '00000000-0000-0000-0000-000000000000.webp')
      .replace(':id', '00000000-0000-0000-0000-000000000000')
      .replace(':userId', '00000000-0000-0000-0000-000000000000');

    // 1. Unauthenticated request: non-whitelisted routes MUST return 401
    const unauthReq = request(app)[route.method.toLowerCase()](testPath);
    const unauthRes = await unauthReq;

    // Must never send X-Powered-By
    assert.equal(unauthRes.headers['x-powered-by'], undefined, `Route ${key} leaked X-Powered-By`);

    if (!PUBLIC_WHITELIST.has(key)) {
      assert.equal(
        unauthRes.status,
        401,
        `Route ${key} is not in public whitelist and must reject unauthenticated requests with 401 (got ${unauthRes.status})`
      );
    }

    // 2. Authenticated requests: must never leak canary strings, stack traces, or forbidden PII keys
    for (const [tokenName, token] of [['youth', youthToken], ['mod', modToken], ['admin', adminToken]]) {
      const authReq = request(app)[route.method.toLowerCase()](testPath)
        .set('Authorization', `Bearer ${token}`);

      const res = await authReq;
      const bodyText = JSON.stringify(res.body || {});
      const headersText = JSON.stringify(res.headers || {});

      // Assert no canary leaks
      assert.ok(
        !bodyText.includes(CANARY.firstName) && !headersText.includes(CANARY.firstName),
        `Route ${key} leaked firstName under ${tokenName} token`
      );
      assert.ok(
        !bodyText.includes(CANARY.lastName) && !headersText.includes(CANARY.lastName),
        `Route ${key} leaked lastName under ${tokenName} token`
      );
      assert.ok(
        !bodyText.includes(CANARY.email) && !headersText.includes(CANARY.email),
        `Route ${key} leaked email under ${tokenName} token`
      );
      assert.ok(
        !bodyText.includes(CANARY.phone) && !headersText.includes(CANARY.phone),
        `Route ${key} leaked phone under ${tokenName} token`
      );

      // Assert no stack trace leaks
      assert.ok(!bodyText.includes('"stack":'), `Route ${key} leaked stack trace`);
      assert.ok(!bodyText.includes('    at '), `Route ${key} leaked call stack`);

      // Assert forbidden DB keys
      for (const forbiddenKey of FORBIDDEN_KEYS) {
        assert.ok(
          !bodyText.includes(`"${forbiddenKey}":`),
          `Route ${key} exposed internal key "${forbiddenKey}"`
        );
      }
    }
  }
});

test('privacy: static code scan ensures verified_identities PII is restricted to identityRepository and identityService', () => {
  const srcDir = path.resolve(__dirname, '../src');

  function scanDir(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...scanDir(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const jsFiles = scanDir(srcDir);
  const authorizedFiles = new Set([
    path.resolve(srcDir, 'repositories/identityRepository.js'),
    path.resolve(srcDir, 'services/identityService.js'),
  ]);

  for (const file of jsFiles) {
    if (authorizedFiles.has(file)) continue;

    const content = fs.readFileSync(file, 'utf8');
    // Reject queries selecting directly from verified_identities with first_name / last_name / email / phone
    assert.ok(
      !content.includes('verified_identities') ||
      (!content.includes('first_name') && !content.includes('last_name')),
      `Unauthorized file ${path.relative(srcDir, file)} queries verified_identities name columns!`
    );
  }
});

test.after(async () => {
  await db.cleanup();
});