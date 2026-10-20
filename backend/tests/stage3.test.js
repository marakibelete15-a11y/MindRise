'use strict';

process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs');
const app = require('../src/app');
const env = require('../src/config/env');
const { hashOtp } = require('../src/utils/otp');
const notificationService = require('../src/services/notificationService');
const avatarStorage = require('../src/services/avatarStorage');
const db = require('./helpers/db');
const authHelper = require('./helpers/auth');

// Minimal valid PNG (1x1 red pixel)
const VALID_1X1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const FORBIDDEN_PRIVACY_KEYS = [
  'firstName',
  'lastName',
  'first_name',
  'last_name',
  'email',
  'phone',
  'password',
  'password_hash',
  'passwordHash',
];

function assertNoPrivacyLeaks(target, contextMsg = '') {
  if (!target || typeof target !== 'object') return;
  for (const key of Object.keys(target)) {
    for (const forbidden of FORBIDDEN_PRIVACY_KEYS) {
      assert.notEqual(
        key.toLowerCase(),
        forbidden.toLowerCase(),
        `Privacy leak in ${contextMsg}: found key "${key}"`
      );
    }
    if (typeof target[key] === 'object') {
      assertNoPrivacyLeaks(target[key], `${contextMsg} -> ${key}`);
    }
  }
}

// ==========================================
// 1. Account Recovery Flow (SRS FR-1.8)
// ==========================================

test('POST /api/auth/recover/request - returns 202 for known and unknown accounts alike', async () => {
  const user = await authHelper.createTestUser({ verified: true });
  const rawEmail = `${user.alias}@example.test`;

  // 1. Known account -> 202 Accepted
  const knownRes = await request(app)
    .post('/api/auth/recover/request')
    .send({ identifier: rawEmail });
  assert.equal(knownRes.status, 202);
  assert.ok(knownRes.body.message);

  // Challenge created in DB
  const challengeRes = await db.query(
    'SELECT * FROM verification_challenges WHERE user_id = $1 AND purpose = $2',
    [user.id, 'recovery']
  );
  assert.equal(challengeRes.rowCount, 1);
  assert.equal(challengeRes.rows[0].purpose, 'recovery');

  // 2. Unknown account -> identical 202 Accepted and message
  const unknownRes = await request(app)
    .post('/api/auth/recover/request')
    .send({ identifier: 'nobody_exists@example.test' });
  assert.equal(unknownRes.status, 202);
  assert.equal(unknownRes.body.message, knownRes.body.message);
});

test('POST /api/auth/recover/confirm - resets password and consumes challenge', async () => {
  const user = await authHelper.createTestUser({ verified: true });
  const rawEmail = `${user.alias}@example.test`;

  // Request recovery
  await request(app).post('/api/auth/recover/request').send({ identifier: rawEmail });

  // Update challenge token_hash to predictable HMAC: '543210'
  const recoveryCode = '543210';
  const expectedHash = hashOtp(recoveryCode, env.otpPepper);
  await db.query(
    'UPDATE verification_challenges SET token_hash = $1 WHERE user_id = $2 AND purpose = $3',
    [expectedHash, user.id, 'recovery']
  );

  // 1. Wrong code returns 400 INVALID_CODE
  const wrongRes = await request(app)
    .post('/api/auth/recover/confirm')
    .send({ identifier: rawEmail, code: '000000', newPassword: 'NewValidPassword123!' });
  assert.equal(wrongRes.status, 400);
  assert.equal(wrongRes.body.error.code, 'INVALID_CODE');

  // 2. Correct code resets password
  const correctRes = await request(app)
    .post('/api/auth/recover/confirm')
    .send({ identifier: rawEmail, code: recoveryCode, newPassword: 'NewValidPassword123!' });
  assert.equal(correctRes.status, 200);

  // Verify DB state: password_changed_at is set, challenge consumed
  const userRow = await db.query(
    'SELECT password_changed_at FROM users WHERE id = $1',
    [user.id]
  );
  assert.ok(userRow.rows[0].password_changed_at !== null);

  const challengeRow = await db.query(
    'SELECT consumed_at FROM verification_challenges WHERE user_id = $1 AND purpose = $2',
    [user.id, 'recovery']
  );
  assert.ok(challengeRow.rows[0].consumed_at !== null);

  // Can log in with new password
  const loginRes = await request(app).post('/api/auth/login').send({
    identifier: rawEmail,
    password: 'NewValidPassword123!',
  });
  assert.equal(loginRes.status, 200);

  // Cannot log in with old password
  const oldLoginRes = await request(app).post('/api/auth/login').send({
    identifier: rawEmail,
    password: 'TestPassword123!',
  });
  assert.equal(oldLoginRes.status, 401);
});

test('POST /api/auth/recover/confirm - locks challenge after 5 failed attempts with CODE_EXHAUSTED', async () => {
  const user = await authHelper.createTestUser({ verified: true });
  const rawEmail = `${user.alias}@example.test`;

  await request(app).post('/api/auth/recover/request').send({ identifier: rawEmail });

  for (let i = 1; i <= 4; i++) {
    const res = await request(app)
      .post('/api/auth/recover/confirm')
      .send({ identifier: rawEmail, code: '111111', newPassword: 'NewValidPassword123!' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_CODE');
  }

  // 5th attempt exhausts code
  const fifthRes = await request(app)
    .post('/api/auth/recover/confirm')
    .send({ identifier: rawEmail, code: '111111', newPassword: 'NewValidPassword123!' });
  assert.equal(fifthRes.status, 400);
  assert.equal(fifthRes.body.error.code, 'CODE_EXHAUSTED');
});

// ==========================================
// 2. Session Invalidation (Migration 015)
// ==========================================

test('session invalidation: token issued before password_changed_at is rejected with 401', async () => {
  const user = await authHelper.createTestUser({ verified: true });
  const oldToken = authHelper.makeToken(user);

  // Verify old token works before password change
  const preCheck = await request(app)
    .get('/api/me')
    .set('Authorization', `Bearer ${oldToken}`);
  assert.equal(preCheck.status, 200);

  // Set password_changed_at 5 seconds in the future relative to token iat
  await db.query(
    "UPDATE users SET password_changed_at = now() + INTERVAL '5 seconds' WHERE id = $1",
    [user.id]
  );

  // Old token must now be rejected
  const postCheck = await request(app)
    .get('/api/me')
    .set('Authorization', `Bearer ${oldToken}`);
  assert.equal(postCheck.status, 401);
  assert.equal(postCheck.body.error.code, 'INVALID_TOKEN');
});

// ==========================================
// 3. GET /api/me and Privacy
// ==========================================

test('GET /api/me - returns user profile and settings without leaking private identity', async () => {
  const user = await authHelper.createTestUser({ verified: true });
  const token = authHelper.makeToken(user);

  const res = await request(app)
    .get('/api/me')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.id, user.id);
  assert.equal(res.body.handle, user.alias);
  assert.equal(res.body.role, 'youth');
  assert.equal(res.body.status, 'active');
  assert.equal(res.body.verified, true);
  assert.ok(res.body.settings);
  assert.equal(res.body.settings.language, 'en');

  // Hard privacy check on response body
  assertNoPrivacyLeaks(res.body, 'GET /api/me response');
});

test('GET /api/me - returns avatarUrl: null when avatar file is missing on disk', async () => {
  const user = await authHelper.createTestUser({ verified: true });
  const token = authHelper.makeToken(user);

  // Set avatar_path in DB to nonexistent file
  await db.query(
    "UPDATE profiles SET avatar_path = 'uploads/avatars/00000000-0000-0000-0000-000000000000.webp' WHERE user_id = $1",
    [user.id]
  );

  const res = await request(app)
    .get('/api/me')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.avatarUrl, null);
});

// ==========================================
// 4. PATCH /api/me/profile (FR-1.7)
// ==========================================

test('PATCH /api/me/profile - updates handle and bio, enforces uniqueness without touching identity', async () => {
  const user1 = await authHelper.createTestUser({ verified: true });
  const user2 = await authHelper.createTestUser({ verified: true });
  const token1 = authHelper.makeToken(user1);

  // 1. Successful handle and bio update
  const res = await request(app)
    .patch('/api/me/profile')
    .set('Authorization', `Bearer ${token1}`)
    .send({ handle: 'updated_runner', bio: 'My mental wellness journey' });

  assert.equal(res.status, 200);
  assert.equal(res.body.handle, 'updated_runner');
  assert.equal(res.body.bio, 'My mental wellness journey');

  // Verify verified_identities was NOT touched
  const identityCheck = await db.query(
    'SELECT first_name, email FROM verified_identities WHERE user_id = $1',
    [user1.id]
  );
  assert.equal(identityCheck.rowCount, 1);

  // 2. Conflict on existing handle (case-insensitive) -> 409 HANDLE_TAKEN
  const conflictRes = await request(app)
    .patch('/api/me/profile')
    .set('Authorization', `Bearer ${token1}`)
    .send({ handle: user2.alias.toUpperCase() });

  assert.equal(conflictRes.status, 409);
  assert.equal(conflictRes.body.error.code, 'HANDLE_TAKEN');

  // 3. Reserved handle -> 400 VALIDATION_ERROR
  const reservedRes = await request(app)
    .patch('/api/me/profile')
    .set('Authorization', `Bearer ${token1}`)
    .send({ handle: 'moderator' });
  assert.equal(reservedRes.status, 400);

  // 4. Bio > 500 chars -> 400 VALIDATION_ERROR
  const longBioRes = await request(app)
    .patch('/api/me/profile')
    .set('Authorization', `Bearer ${token1}`)
    .send({ bio: 'A'.repeat(501) });
  assert.equal(longBioRes.status, 400);
});

// ==========================================
// 5. Avatar Upload & Serving (FR-1.3, 1.7)
// ==========================================

test('POST /api/me/avatar and GET /api/avatars/:file - re-encodes, strips EXIF, serves WebP', async () => {
  const user = await authHelper.createTestUser({ verified: true });
  const token = authHelper.makeToken(user);

  // 1. Upload valid image
  const uploadRes = await request(app)
    .post('/api/me/avatar')
    .set('Authorization', `Bearer ${token}`)
    .attach('avatar', VALID_1X1_PNG, 'custom_user_photo.png');

  assert.equal(uploadRes.status, 200);
  assert.ok(uploadRes.body.avatarUrl);
  assert.ok(uploadRes.body.avatarUrl.startsWith('/api/avatars/'));
  assert.ok(uploadRes.body.avatarUrl.endsWith('.webp'));

  const avatarFilename = path.basename(uploadRes.body.avatarUrl);

  // Verify file on disk is resized WebP
  const diskPath = avatarStorage.resolve(avatarFilename);
  assert.ok(diskPath, 'Avatar must exist on disk');
  const metadata = await sharp(diskPath).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 256);
  assert.equal(metadata.height, 256);
  assert.equal(metadata.exif, undefined, 'EXIF metadata must be stripped');

  // 2. Retrieve avatar via GET /api/avatars/:file
  const getAvatarRes = await request(app).get(uploadRes.body.avatarUrl);
  assert.equal(getAvatarRes.status, 200);
  assert.equal(getAvatarRes.headers['content-type'], 'image/webp');
  assert.equal(getAvatarRes.headers['x-content-type-options'], 'nosniff');
  assert.ok(getAvatarRes.headers['cache-control'].includes('public'));

  // Clean up uploaded file
  await avatarStorage.remove(`uploads/avatars/${avatarFilename}`);
});

test('POST /api/me/avatar - rejects fake image with .png extension', async () => {
  const user = await authHelper.createTestUser({ verified: true });
  const token = authHelper.makeToken(user);

  const fakePngBuffer = Buffer.from('NOT_A_REAL_IMAGE_DATA_JUST_TEXT');

  const res = await request(app)
    .post('/api/me/avatar')
    .set('Authorization', `Bearer ${token}`)
    .attach('avatar', fakePngBuffer, 'exploit.png');

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('GET /api/avatars/:file - rejects path traversal attempts', async () => {
  const traversalRes = await request(app).get('/api/avatars/..%2F..%2Fpackage.json');
  assert.equal(traversalRes.status, 404);

  const badPatternRes = await request(app).get('/api/avatars/not-a-uuid.webp');
  assert.equal(badPatternRes.status, 404);
});

// ==========================================
// 6. Settings (FR-5.2)
// ==========================================

test('GET & PATCH /api/me/settings - retrieves and updates user settings with IANA timezone validation', async () => {
  const user = await authHelper.createTestUser({ verified: true });
  const token = authHelper.makeToken(user);

  // 1. GET settings
  const getRes = await request(app)
    .get('/api/me/settings')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.language, 'en');

  // 2. PATCH settings with valid values
  const patchRes = await request(app)
    .patch('/api/me/settings')
    .set('Authorization', `Bearer ${token}`)
    .send({
      language: 'am',
      timezone: 'Africa/Addis_Ababa',
      pushEnabled: false,
      emailEnabled: true,
      profileVisibility: 'private',
    });

  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.language, 'am');
  assert.equal(patchRes.body.timezone, 'Africa/Addis_Ababa');
  assert.equal(patchRes.body.pushEnabled, false);
  assert.equal(patchRes.body.emailEnabled, true);
  assert.equal(patchRes.body.profileVisibility, 'private');

  // 3. Reject invalid language code
  const badLangRes = await request(app)
    .patch('/api/me/settings')
    .set('Authorization', `Bearer ${token}`)
    .send({ language: 'fr' });
  assert.equal(badLangRes.status, 400);

  // 4. Reject invalid IANA timezone
  const badTzRes = await request(app)
    .patch('/api/me/settings')
    .set('Authorization', `Bearer ${token}`)
    .send({ timezone: 'Invalid/NonExistent_Zone' });
  assert.equal(badTzRes.status, 400);
});

// ==========================================
// 7. Notifications (FR-5.x) & IDOR Protection
// ==========================================

test('notifications: service creation, cursor paging, and IDOR protection', async () => {
  const userA = await authHelper.createTestUser({ verified: true });
  const userB = await authHelper.createTestUser({ verified: true });
  const tokenA = authHelper.makeToken(userA);
  const tokenB = authHelper.makeToken(userB);

  // 1. Create notification via service
  const notifA = await notificationService.create({
    userId: userA.id,
    type: 'routine_reminder',
    title: 'Self-Care Reminder',
    body: 'Take 5 minutes to breathe today.',
    payload: { routineId: '123' },
  });
  assert.ok(notifA.id);

  // 2. User A lists notifications
  const listRes = await request(app)
    .get('/api/me/notifications')
    .set('Authorization', `Bearer ${tokenA}`);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.items.length, 1);
  assert.equal(listRes.body.unreadCount, 1);
  assert.equal(listRes.body.items[0].id, notifA.id);

  // 3. IDOR Defense: User B attempts to mark User A's notification as read
  // Must return 404 NOT_FOUND (never 403) to prevent ID probing
  const idorRes = await request(app)
    .post(`/api/me/notifications/${notifA.id}/read`)
    .set('Authorization', `Bearer ${tokenB}`);
  assert.equal(idorRes.status, 404);
  assert.equal(idorRes.body.error.code, 'NOT_FOUND');

  // 4. User A marks notification as read
  const readRes = await request(app)
    .post(`/api/me/notifications/${notifA.id}/read`)
    .set('Authorization', `Bearer ${tokenA}`);
  assert.equal(readRes.status, 200);
  assert.equal(readRes.body.read, true);

  // 5. Read-all clears unreadCount
  await notificationService.create({
    userId: userA.id,
    type: 'badge_awarded',
    title: 'First Step Badge',
    body: 'You completed your first self-assessment!',
  });

  const readAllRes = await request(app)
    .post('/api/me/notifications/read-all')
    .set('Authorization', `Bearer ${tokenA}`);
  assert.equal(readAllRes.status, 200);
  assert.equal(readAllRes.body.success, true);

  const postReadAll = await request(app)
    .get('/api/me/notifications')
    .set('Authorization', `Bearer ${tokenA}`);
  assert.equal(postReadAll.body.unreadCount, 0);
});

test.after(async () => {
  await db.cleanup();
});
