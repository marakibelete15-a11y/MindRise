'use strict';

process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const env = require('../src/config/env');
const { decrypt } = require('../src/utils/crypto');
const { hashOtp } = require('../src/utils/otp');
const db = require('./helpers/db');

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

test('POST /api/auth/register - happy path with email', async () => {
  const payload = {
    handle: 'abebe_bikila',
    firstName: 'Abebe',
    lastName: 'Bikila',
    email: 'abebe.test@example.com',
    password: 'ValidPassword123!',
    termsAccepted: true,
    disclaimerAccepted: true,
    consentVersion: '1.0',
  };

  const res = await request(app)
    .post('/api/auth/register')
    .send(payload);

  assert.equal(res.status, 201);
  assert.ok(res.body.token, 'Token must be returned');
  assert.ok(res.body.user, 'User object must be returned');
  assert.equal(res.body.user.handle, 'abebe_bikila');
  assert.equal(res.body.user.role, 'youth');
  assert.equal(res.body.user.verified, false);

  const userId = res.body.user.id;
  assert.ok(userId);
  db.trackUser(userId);

  // Hard privacy check on response body
  assertNoPrivacyLeaks(res.body, 'register response');

  // Verify DB state: verified_identities encrypted at rest (SRS 5.4 Decision C)
  const identityRes = await db.query(
    'SELECT * FROM verified_identities WHERE user_id = $1',
    [userId]
  );
  assert.equal(identityRes.rowCount, 1);
  const identity = identityRes.rows[0];

  assert.ok(identity.first_name.startsWith('v1:'), 'first_name must be encrypted with v1 prefix');
  assert.ok(identity.last_name.startsWith('v1:'), 'last_name must be encrypted with v1 prefix');
  assert.notEqual(identity.first_name, 'Abebe');
  assert.notEqual(identity.last_name, 'Bikila');
  assert.equal(decrypt(identity.first_name), 'Abebe');
  assert.equal(decrypt(identity.last_name), 'Bikila');
  assert.equal(identity.email, 'abebe.test@example.com');
  assert.equal(identity.email_verified_at, null);

  // Verify user_settings seeded
  const settingsRes = await db.query(
    'SELECT * FROM user_settings WHERE user_id = $1',
    [userId]
  );
  assert.equal(settingsRes.rowCount, 1);

  // Verify user_stats seeded
  const statsRes = await db.query(
    'SELECT * FROM user_stats WHERE user_id = $1',
    [userId]
  );
  assert.equal(statsRes.rowCount, 1);
  assert.equal(statsRes.rows[0].points, 0);

  // Verify verification_challenges row created
  const challengeRes = await db.query(
    'SELECT * FROM verification_challenges WHERE user_id = $1 AND purpose = $2',
    [userId, 'signup']
  );
  assert.equal(challengeRes.rowCount, 1);
  assert.equal(challengeRes.rows[0].channel, 'email');
  assert.equal(challengeRes.rows[0].attempts, 0);
  assert.equal(challengeRes.rows[0].consumed_at, null);
});

test('POST /api/auth/register - happy path with Ethiopian phone', async () => {
  const payload = {
    handle: 'chala_kebede',
    firstName: 'Chala',
    lastName: 'Kebede',
    phone: '0912345678',
    password: 'ValidPassword123!',
    termsAccepted: true,
    disclaimerAccepted: true,
    consentVersion: '1.0',
  };

  const res = await request(app)
    .post('/api/auth/register')
    .send(payload);

  assert.equal(res.status, 201);
  const userId = res.body.user.id;
  db.trackUser(userId);

  assertNoPrivacyLeaks(res.body, 'register phone response');

  // Phone should be normalized to E.164 (+251912345678)
  const identityRes = await db.query(
    'SELECT * FROM verified_identities WHERE user_id = $1',
    [userId]
  );
  assert.equal(identityRes.rows[0].phone, '+251912345678');
  assert.equal(identityRes.rows[0].phone_verified_at, null);

  const challengeRes = await db.query(
    'SELECT * FROM verification_challenges WHERE user_id = $1',
    [userId]
  );
  assert.equal(challengeRes.rows[0].channel, 'phone');
});

test('POST /api/auth/register - allows Unicode Amharic letter names', async () => {
  const payload = {
    handle: 'amharic_user',
    firstName: 'አበበ',
    lastName: 'ቢቂላ',
    email: 'amharic.user@example.com',
    password: 'ValidPassword123!',
    termsAccepted: true,
    disclaimerAccepted: true,
    consentVersion: '1.0',
  };

  const res = await request(app)
    .post('/api/auth/register')
    .send(payload);

  assert.equal(res.status, 201);
  const userId = res.body.user.id;
  db.trackUser(userId);

  const identityRes = await db.query(
    'SELECT * FROM verified_identities WHERE user_id = $1',
    [userId]
  );
  assert.equal(decrypt(identityRes.rows[0].first_name), 'አበበ');
  assert.equal(decrypt(identityRes.rows[0].last_name), 'ቢቂላ');
});

test('POST /api/auth/register - rejects invalid input schemas', async () => {
  const base = {
    handle: 'valid_user',
    firstName: 'First',
    lastName: 'Last',
    email: 'valid@example.com',
    password: 'ValidPassword123!',
    termsAccepted: true,
    disclaimerAccepted: true,
    consentVersion: '1.0',
  };

  // 1. Digits-only name
  const badNameRes = await request(app)
    .post('/api/auth/register')
    .send({ ...base, firstName: '12345' });
  assert.equal(badNameRes.status, 400);
  assert.equal(badNameRes.body.error.code, 'VALIDATION_ERROR');

  // 2. Emoji name
  const emojiNameRes = await request(app)
    .post('/api/auth/register')
    .send({ ...base, firstName: '😊😊' });
  assert.equal(emojiNameRes.status, 400);
  assert.equal(emojiNameRes.body.error.code, 'VALIDATION_ERROR');

  // 3. Reserved handles
  for (const reserved of ['admin', 'moderator', 'mindrise', 'support']) {
    const reservedRes = await request(app)
      .post('/api/auth/register')
      .send({ ...base, handle: reserved });
    assert.equal(reservedRes.status, 400);
    assert.equal(reservedRes.body.error.code, 'VALIDATION_ERROR');
  }

  // 4. Invalid handle format (symbols, spaces)
  const badHandleRes = await request(app)
    .post('/api/auth/register')
    .send({ ...base, handle: 'bad handle!' });
  assert.equal(badHandleRes.status, 400);

  // 5. Weak password (in common list)
  const weakPwRes = await request(app)
    .post('/api/auth/register')
    .send({ ...base, password: 'password' });
  assert.equal(weakPwRes.status, 400);
  assert.equal(weakPwRes.body.error.code, 'VALIDATION_ERROR');

  // 6. Password too short (< 8 chars)
  const shortPwRes = await request(app)
    .post('/api/auth/register')
    .send({ ...base, password: 'short' });
  assert.equal(shortPwRes.status, 400);

  // 7. Terms not accepted
  const noTermsRes = await request(app)
    .post('/api/auth/register')
    .send({ ...base, termsAccepted: false });
  assert.equal(noTermsRes.status, 400);

  // 8. Disclaimer not accepted
  const noDiscRes = await request(app)
    .post('/api/auth/register')
    .send({ ...base, disclaimerAccepted: false });
  assert.equal(noDiscRes.status, 400);

  // 9. Both email and phone provided
  const bothRes = await request(app)
    .post('/api/auth/register')
    .send({ ...base, phone: '0911223344' });
  assert.equal(bothRes.status, 400);

  // 10. Neither email nor phone provided
  const nonePayload = { ...base };
  delete nonePayload.email;
  const noneRes = await request(app)
    .post('/api/auth/register')
    .send(nonePayload);
  assert.equal(noneRes.status, 400);
});

test('POST /api/auth/register - duplicate handle returns 409 HANDLE_TAKEN', async () => {
  const user1 = {
    handle: 'unique_runner',
    firstName: 'First',
    lastName: 'Last',
    email: 'runner1@example.com',
    password: 'ValidPassword123!',
    termsAccepted: true,
    disclaimerAccepted: true,
    consentVersion: '1.0',
  };

  const res1 = await request(app).post('/api/auth/register').send(user1);
  assert.equal(res1.status, 201);
  db.trackUser(res1.body.user.id);

  // Case-insensitive duplicate check: 'UNIQUE_RUNNER'
  const user2 = {
    ...user1,
    handle: 'UNIQUE_RUNNER',
    email: 'runner2@example.com',
  };

  const res2 = await request(app).post('/api/auth/register').send(user2);
  assert.equal(res2.status, 409);
  assert.equal(res2.body.error.code, 'HANDLE_TAKEN');
});

test('POST /api/auth/register - duplicate contact returns generic 409 ACCOUNT_EXISTS', async () => {
  const user1 = {
    handle: 'first_user',
    firstName: 'First',
    lastName: 'Last',
    email: 'shared@example.com',
    password: 'ValidPassword123!',
    termsAccepted: true,
    disclaimerAccepted: true,
    consentVersion: '1.0',
  };

  const res1 = await request(app).post('/api/auth/register').send(user1);
  assert.equal(res1.status, 201);
  db.trackUser(res1.body.user.id);

  // Same email, different handle
  const user2 = {
    ...user1,
    handle: 'second_user',
  };

  const res2 = await request(app).post('/api/auth/register').send(user2);
  assert.equal(res2.status, 409);
  assert.equal(res2.body.error.code, 'ACCOUNT_EXISTS');
});

test('POST /api/auth/verify - verifies code and updates verified_identities', async () => {
  const regRes = await request(app).post('/api/auth/register').send({
    handle: 'verify_user',
    firstName: 'Verify',
    lastName: 'User',
    email: 'verify.user@example.com',
    password: 'ValidPassword123!',
    termsAccepted: true,
    disclaimerAccepted: true,
    consentVersion: '1.0',
  });
  assert.equal(regRes.status, 201);
  const userId = regRes.body.user.id;
  const token = regRes.body.token;
  db.trackUser(userId);

  // Set predictable OTP hash in database: code '654321'
  const testCode = '654321';
  const expectedHash = hashOtp(testCode, env.otpPepper);
  await db.query(
    'UPDATE verification_challenges SET token_hash = $1 WHERE user_id = $2',
    [expectedHash, userId]
  );

  // 1. Wrong code returns 400 INVALID_CODE and increments attempts
  const wrongRes = await request(app)
    .post('/api/auth/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ code: '000000' });
  assert.equal(wrongRes.status, 400);
  assert.equal(wrongRes.body.error.code, 'INVALID_CODE');

  const checkAttempts = await db.query(
    'SELECT attempts FROM verification_challenges WHERE user_id = $1',
    [userId]
  );
  assert.equal(checkAttempts.rows[0].attempts, 1);

  // 2. Correct code returns 200 { verified: true }
  const correctRes = await request(app)
    .post('/api/auth/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ code: testCode });
  assert.equal(correctRes.status, 200);
  assert.deepEqual(correctRes.body, { verified: true });

  // 3. Database check: email_verified_at set, challenge consumed
  const identityRes = await db.query(
    'SELECT email_verified_at FROM verified_identities WHERE user_id = $1',
    [userId]
  );
  assert.ok(identityRes.rows[0].email_verified_at !== null);

  const challengeRes = await db.query(
    'SELECT consumed_at FROM verification_challenges WHERE user_id = $1',
    [userId]
  );
  assert.ok(challengeRes.rows[0].consumed_at !== null);
});

test('POST /api/auth/verify - 5 failed attempts locks challenge with CODE_EXHAUSTED', async () => {
  const regRes = await request(app).post('/api/auth/register').send({
    handle: 'lockout_user',
    firstName: 'Lock',
    lastName: 'Out',
    email: 'lockout@example.com',
    password: 'ValidPassword123!',
    termsAccepted: true,
    disclaimerAccepted: true,
    consentVersion: '1.0',
  });
  const userId = regRes.body.user.id;
  const token = regRes.body.token;
  db.trackUser(userId);

  // Send 4 wrong attempts
  for (let i = 1; i <= 4; i++) {
    const res = await request(app)
      .post('/api/auth/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '111111' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_CODE');
  }

  // 5th attempt locks challenge -> CODE_EXHAUSTED
  const fifthRes = await request(app)
    .post('/api/auth/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ code: '111111' });
  assert.equal(fifthRes.status, 400);
  assert.equal(fifthRes.body.error.code, 'CODE_EXHAUSTED');

  // Verify challenge is consumed in DB
  const challengeRes = await db.query(
    'SELECT consumed_at, attempts FROM verification_challenges WHERE user_id = $1',
    [userId]
  );
  assert.equal(challengeRes.rows[0].attempts, 5);
  assert.ok(challengeRes.rows[0].consumed_at !== null);
});

test('POST /api/auth/verify - rejects expired code', async () => {
  const regRes = await request(app).post('/api/auth/register').send({
    handle: 'expired_user',
    firstName: 'Expire',
    lastName: 'User',
    email: 'expired@example.com',
    password: 'ValidPassword123!',
    termsAccepted: true,
    disclaimerAccepted: true,
    consentVersion: '1.0',
  });
  const userId = regRes.body.user.id;
  const token = regRes.body.token;
  db.trackUser(userId);

  // Set code hash but expire the challenge
  const testCode = '654321';
  const expectedHash = hashOtp(testCode, env.otpPepper);
  await db.query(
    `UPDATE verification_challenges
     SET token_hash = $1, created_at = NOW() - INTERVAL '20 minutes', expires_at = NOW() - INTERVAL '5 minutes'
     WHERE user_id = $2`,
    [expectedHash, userId]
  );

  const res = await request(app)
    .post('/api/auth/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ code: testCode });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_CODE');
});

test('POST /api/auth/resend-code - enforces cooldown and sends new challenge', async () => {
  const regRes = await request(app).post('/api/auth/register').send({
    handle: 'resend_user',
    firstName: 'Resend',
    lastName: 'User',
    email: 'resend@example.com',
    password: 'ValidPassword123!',
    termsAccepted: true,
    disclaimerAccepted: true,
    consentVersion: '1.0',
  });
  const userId = regRes.body.user.id;
  const token = regRes.body.token;
  db.trackUser(userId);

  // 1. Immediate resend within cooldown -> 429 RATE_LIMIT_EXCEEDED
  const cooldownRes = await request(app)
    .post('/api/auth/resend-code')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  assert.equal(cooldownRes.status, 429);
  assert.equal(cooldownRes.body.error.code, 'RATE_LIMIT_EXCEEDED');

  // 2. Backdate created_at beyond cooldown
  await db.query(
    "UPDATE verification_challenges SET created_at = NOW() - INTERVAL '70 seconds' WHERE user_id = $1",
    [userId]
  );

  const resendRes = await request(app)
    .post('/api/auth/resend-code')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  assert.equal(resendRes.status, 200);
  assert.deepEqual(resendRes.body, { sent: true });

  // Verify older challenge is consumed and newer challenge is unconsumed
  const challenges = await db.query(
    'SELECT consumed_at FROM verification_challenges WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  assert.equal(challenges.rowCount, 2);
  assert.ok(challenges.rows[0].consumed_at !== null, 'Old challenge should be consumed');
  assert.equal(challenges.rows[1].consumed_at, null, 'New challenge should be unconsumed');

  // 3. Resend for already verified user returns 409 ALREADY_VERIFIED
  await db.query(
    'UPDATE verified_identities SET email_verified_at = NOW() WHERE user_id = $1',
    [userId]
  );
  const alreadyRes = await request(app)
    .post('/api/auth/resend-code')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  assert.equal(alreadyRes.status, 409);
  assert.equal(alreadyRes.body.error.code, 'ALREADY_VERIFIED');
});

test('POST /api/auth/login - happy path and error cases', async () => {
  const password = 'StrongUserPassword123!';
  const regEmail = await request(app).post('/api/auth/register').send({
    handle: 'login_email_user',
    firstName: 'Login',
    lastName: 'Email',
    email: 'login.email@example.com',
    password,
    termsAccepted: true,
    disclaimerAccepted: true,
    consentVersion: '1.0',
  });
  const emailUserId = regEmail.body.user.id;
  db.trackUser(emailUserId);

  const regPhone = await request(app).post('/api/auth/register').send({
    handle: 'login_phone_user',
    firstName: 'Login',
    lastName: 'Phone',
    phone: '0922334455',
    password,
    termsAccepted: true,
    disclaimerAccepted: true,
    consentVersion: '1.0',
  });
  const phoneUserId = regPhone.body.user.id;
  db.trackUser(phoneUserId);

  // 1. Login with email
  const emailLoginRes = await request(app).post('/api/auth/login').send({
    identifier: 'login.email@example.com',
    password,
  });
  assert.equal(emailLoginRes.status, 200);
  assert.ok(emailLoginRes.body.token);
  assert.equal(emailLoginRes.body.user.id, emailUserId);
  assert.equal(emailLoginRes.body.user.handle, 'login_email_user');
  assert.equal(emailLoginRes.body.user.role, 'youth');
  assert.equal(emailLoginRes.body.user.status, 'active');
  assertNoPrivacyLeaks(emailLoginRes.body, 'email login response');

  // 2. Login with phone (local format '0922334455')
  const phoneLoginRes = await request(app).post('/api/auth/login').send({
    identifier: '0922334455',
    password,
  });
  assert.equal(phoneLoginRes.status, 200);
  assert.equal(phoneLoginRes.body.user.id, phoneUserId);
  assertNoPrivacyLeaks(phoneLoginRes.body, 'phone login response');

  // 3. Login with wrong password -> 401 INVALID_CREDENTIALS
  const wrongPwRes = await request(app).post('/api/auth/login').send({
    identifier: 'login.email@example.com',
    password: 'WrongPassword!',
  });
  assert.equal(wrongPwRes.status, 401);
  assert.equal(wrongPwRes.body.error.code, 'INVALID_CREDENTIALS');

  // 4. Login with nonexistent identifier -> 401 INVALID_CREDENTIALS (same code and message)
  const unknownUserRes = await request(app).post('/api/auth/login').send({
    identifier: 'nonexistent@example.com',
    password: 'SomePassword123!',
  });
  assert.equal(unknownUserRes.status, 401);
  assert.equal(unknownUserRes.body.error.code, 'INVALID_CREDENTIALS');
  assert.equal(unknownUserRes.body.error.message, wrongPwRes.body.error.message);

  // 5. Suspended user -> 403 ACCOUNT_SUSPENDED
  await db.query("UPDATE users SET status = 'suspended' WHERE id = $1", [emailUserId]);
  const suspendedRes = await request(app).post('/api/auth/login').send({
    identifier: 'login.email@example.com',
    password,
  });
  assert.equal(suspendedRes.status, 403);
  assert.equal(suspendedRes.body.error.code, 'ACCOUNT_SUSPENDED');

  // 6. deletion_pending user -> allowed to log in
  await db.query("UPDATE users SET status = 'deletion_pending' WHERE id = $1", [emailUserId]);
  const deletionPendingRes = await request(app).post('/api/auth/login').send({
    identifier: 'login.email@example.com',
    password,
  });
  assert.equal(deletionPendingRes.status, 200);
  assert.equal(deletionPendingRes.body.user.status, 'deletion_pending');
});

test.after(async () => {
  await db.cleanup();
});
