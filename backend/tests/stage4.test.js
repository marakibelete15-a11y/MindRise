'use strict';

process.env.NODE_ENV = 'test';

// Stage 4 Test Suite: Retention and Privacy (SRS FR-1.3, FR-5.4, FR-7.5, DB-4.2, 4.5, 4.6).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const request = require('supertest');
const bcrypt = require('bcryptjs');

const app = require('../src/app');
const pool = require('../src/config/db');
const env = require('../src/config/env');
const crypto = require('../src/utils/crypto');
const retentionService = require('../src/services/retentionService');
const identityService = require('../src/services/identityService');
const otpSender = require('../src/services/otpSender');
const db = require('./helpers/db');
const authHelper = require('./helpers/auth');

test('DELETE /api/me and POST /api/me/restore - lifecycle and content hiding/restoration', async () => {
  const plainPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(plainPassword, 4);

  // 1. Create active youth user
  const user = await authHelper.createTestUser({
    role: 'youth',
    status: 'active',
    verified: true,
  });

  // Update password hash so we know the password
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, user.id]);

  // Insert a space and user posts & comments
  const spaceResult = await pool.query(
    `INSERT INTO community_spaces (slug, title) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
     RETURNING id`,
    [`test-space-${Date.now()}`, 'Test Space']
  );
  const spaceId = spaceResult.rows[0].id;

  const postResult = await pool.query(
    `INSERT INTO community_posts (author_id, space_id, body, status)
     VALUES ($1, $2, 'My visible post before deletion', 'visible')
     RETURNING id`,
    [user.id, spaceId]
  );
  const postId = postResult.rows[0].id;

  const commentResult = await pool.query(
    `INSERT INTO community_comments (post_id, author_id, body, status)
     VALUES ($1, $2, 'My visible comment before deletion', 'visible')
     RETURNING id`,
    [postId, user.id]
  );
  const commentId = commentResult.rows[0].id;

  const token = authHelper.makeToken(user);

  // 2. Reject deletion when password is wrong
  const wrongPassRes = await request(app)
    .delete('/api/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ password: 'WrongPassword999!' });

  assert.equal(wrongPassRes.status, 400);
  assert.equal(wrongPassRes.body.error.code, 'INVALID_CREDENTIALS');

  // Verify status is still active
  const checkActive = await pool.query(`SELECT status FROM users WHERE id = $1`, [user.id]);
  assert.equal(checkActive.rows[0].status, 'active');

  // 3. Confirm deletion with correct password
  const deleteRes = await request(app)
    .delete('/api/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ password: plainPassword });

  assert.equal(deleteRes.status, 200);
  assert.ok(deleteRes.body.purgeDate);
  assert.ok(deleteRes.body.message.includes('Account scheduled for deletion'));

  // Verify DB state: status deletion_pending and content hidden
  const checkPending = await pool.query(
    `SELECT status, deleted_at FROM users WHERE id = $1`,
    [user.id]
  );
  assert.equal(checkPending.rows[0].status, 'deletion_pending');
  assert.ok(checkPending.rows[0].deleted_at);

  const checkPost = await pool.query(`SELECT status FROM community_posts WHERE id = $1`, [postId]);
  assert.equal(checkPost.rows[0].status, 'hidden');

  const checkComment = await pool.query(`SELECT status FROM community_comments WHERE id = $1`, [commentId]);
  assert.equal(checkComment.rows[0].status, 'hidden');

  // 4. GET /api/me is now blocked with 403 ACCOUNT_DELETION_PENDING
  const getMeBlocked = await request(app)
    .get('/api/me')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(getMeBlocked.status, 403);
  assert.equal(getMeBlocked.body.error.code, 'ACCOUNT_DELETION_PENDING');

  // 5. Restore account via POST /api/me/restore
  const restoreRes = await request(app)
    .post('/api/me/restore')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(restoreRes.status, 200);
  assert.equal(restoreRes.body.status, 'active');

  // Verify DB state: active and content restored
  const checkRestored = await pool.query(
    `SELECT status, deleted_at FROM users WHERE id = $1`,
    [user.id]
  );
  assert.equal(checkRestored.rows[0].status, 'active');
  assert.equal(checkRestored.rows[0].deleted_at, null);

  const checkPostRestored = await pool.query(`SELECT status FROM community_posts WHERE id = $1`, [postId]);
  assert.equal(checkPostRestored.rows[0].status, 'visible');

  const checkCommentRestored = await pool.query(`SELECT status FROM community_comments WHERE id = $1`, [commentId]);
  assert.equal(checkCommentRestored.rows[0].status, 'visible');

  // 6. Calling restore on an already-active account fails
  const restoreActiveRes = await request(app)
    .post('/api/me/restore')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(restoreActiveRes.status, 400);
  assert.equal(restoreActiveRes.body.error.code, 'ACCOUNT_NOT_DELETION_PENDING');

  // 7. GET /api/me works again
  const getMeActive = await request(app)
    .get('/api/me')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(getMeActive.status, 200);
});

test('retentionService: dry-run vs execute policy enforcement across database and filesystem', async () => {
  const now = new Date('2026-10-21T12:00:00.000Z');

  // 1. Verification challenges (older than 24 hours)
  const oldChallengeUser = await authHelper.createTestUser();
  const oldChallengeCreated = new Date(now.getTime() - 26 * 60 * 60 * 1000); // 26 hours ago
  const oldChallengeExpires = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago (> created)

  const c1 = await pool.query(
    `INSERT INTO verification_challenges (user_id, channel, token_hash, expires_at, created_at, consumed_at)
     VALUES ($1, 'email', 'hash1', $2, $3, $2)
     RETURNING id`,
    [oldChallengeUser.id, oldChallengeExpires, oldChallengeCreated]
  );
  const challengeId = c1.rows[0].id;

  // 2. Account deletion (older than 30 days)
  const oldDeletionTime = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000); // 31 days ago
  const purgedUser = await authHelper.createTestUser({
    status: 'deletion_pending',
    alias: 'purge_me_31d',
  });
  await pool.query(`UPDATE users SET deleted_at = $1 WHERE id = $2`, [oldDeletionTime, purgedUser.id]);

  // Create an avatar file on disk for the purged user
  const uploadDir = env.uploadDir;
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const avatarFilename = '00000000-0000-4000-8000-000000000099.webp';
  const avatarDiskPath = path.join(uploadDir, avatarFilename);
  await fsPromises.writeFile(avatarDiskPath, Buffer.from('dummy avatar webp bytes'));
  await pool.query(
    `UPDATE profiles SET avatar_path = $1 WHERE user_id = $2`,
    [`uploads/avatars/${avatarFilename}`, purgedUser.id]
  );

  // 3. Removed community posts and comments (older than 90 days)
  const oldContentTime = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000); // 91 days ago
  const postRes = await pool.query(
    `INSERT INTO community_posts (author_id, body, status, deleted_at, updated_at)
     VALUES ($1, 'Removed post older than 90 days', 'removed', $2, $2)
     RETURNING id`,
    [purgedUser.id, oldContentTime]
  );
  const removedPostId = postRes.rows[0].id;

  const commentRes = await pool.query(
    `INSERT INTO community_comments (post_id, author_id, body, status, deleted_at, updated_at)
     VALUES ($1, $2, 'Removed comment older than 90 days', 'removed', $3, $3)
     RETURNING id`,
    [removedPostId, purgedUser.id, oldContentTime]
  );
  const removedCommentId = commentRes.rows[0].id;

  // 4. Closed report (older than 12 months)
  const oldAuditTime = new Date(now.getTime() - 366 * 24 * 60 * 60 * 1000); // 366 days ago
  const reportRes = await pool.query(
    `INSERT INTO content_reports (post_id, reason, status, resolved_at, created_at)
     VALUES ($1, 'Old report', 'resolved', $2, $2)
     RETURNING id`,
    [removedPostId, oldAuditTime]
  );
  const reportId = reportRes.rows[0].id;

  // 5. Moderation action (older than 12 months)
  const actionRes = await pool.query(
    `INSERT INTO moderation_actions (post_id, action, reason, created_at)
     VALUES ($1, 'hide_post', 'Old action', $2)
     RETURNING id`,
    [removedPostId, oldAuditTime]
  );
  const actionId = actionRes.rows[0].id;

  // 6. Identity access log (older than 12 months)
  const logRes = await pool.query(
    `INSERT INTO identity_access_log (actor_id, target_user_id, reason, created_at)
     VALUES ($1, $2, 'Safeguarding audit from last year', $3)
     RETURNING id`,
    [oldChallengeUser.id, purgedUser.id, oldAuditTime]
  );
  const logId = logRes.rows[0].id;

  // 7. Orphan avatar file on disk (older than 24 hours, unreferenced in DB)
  const orphanFilename = '00000000-0000-4000-8000-000000000088.webp';
  const orphanPath = path.join(uploadDir, orphanFilename);
  await fsPromises.writeFile(orphanPath, Buffer.from('orphan avatar file'));
  // Set mtime to 25 hours ago
  const pastTime = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  fs.utimesSync(orphanPath, pastTime, pastTime);

  // --- DRY RUN TEST ---
  const dryRunResults = await retentionService.cleanup({
    now,
    execute: false,
  });

  assert.equal(dryRunResults.executed, false);
  assert.ok(dryRunResults.verificationChallenges.count >= 1);
  assert.ok(dryRunResults.accountsPurged.count >= 1);
  assert.ok(dryRunResults.removedPosts.count >= 1);
  assert.ok(dryRunResults.removedComments.count >= 1);
  assert.ok(dryRunResults.closedReports.count >= 1);
  assert.ok(dryRunResults.moderationActions.count >= 1);
  assert.ok(dryRunResults.identityAccessLogs.count >= 1);
  assert.ok(dryRunResults.orphanAvatars.count >= 1);

  // Ensure nothing was deleted during dry-run
  const dryCheckChallenge = await pool.query(`SELECT id FROM verification_challenges WHERE id = $1`, [challengeId]);
  assert.equal(dryCheckChallenge.rows.length, 1);
  const dryCheckUser = await pool.query(`SELECT id FROM users WHERE id = $1`, [purgedUser.id]);
  assert.equal(dryCheckUser.rows.length, 1);
  assert.ok(fs.existsSync(avatarDiskPath));
  assert.ok(fs.existsSync(orphanPath));

  // --- LIVE EXECUTE TEST ---
  const execResults = await retentionService.cleanup({
    now,
    execute: true,
  });

  assert.equal(execResults.executed, true);
  assert.ok(execResults.verificationChallenges.count >= 1);
  assert.ok(execResults.accountsPurged.count >= 1);

  // Assert records and files were deleted
  const checkChallengeAfter = await pool.query(`SELECT id FROM verification_challenges WHERE id = $1`, [challengeId]);
  assert.equal(checkChallengeAfter.rows.length, 0);

  const checkUserAfter = await pool.query(`SELECT id FROM users WHERE id = $1`, [purgedUser.id]);
  assert.equal(checkUserAfter.rows.length, 0);

  // User avatar file should be removed from disk
  assert.equal(fs.existsSync(avatarDiskPath), false);

  // Orphan avatar file should be removed from disk
  assert.equal(fs.existsSync(orphanPath), false);

  // Removed post, comment, report, action, log should be purged
  const checkPostAfter = await pool.query(`SELECT id FROM community_posts WHERE id = $1`, [removedPostId]);
  assert.equal(checkPostAfter.rows.length, 0);
  const checkCommentAfter = await pool.query(`SELECT id FROM community_comments WHERE id = $1`, [removedCommentId]);
  assert.equal(checkCommentAfter.rows.length, 0);
  const checkReportAfter = await pool.query(`SELECT id FROM content_reports WHERE id = $1`, [reportId]);
  assert.equal(checkReportAfter.rows.length, 0);
  const checkActionAfter = await pool.query(`SELECT id FROM moderation_actions WHERE id = $1`, [actionId]);
  assert.equal(checkActionAfter.rows.length, 0);
  const checkLogAfter = await pool.query(`SELECT id FROM identity_access_log WHERE id = $1`, [logId]);
  assert.equal(checkLogAfter.rows.length, 0);
});

test('scripts/cleanup.js: executes in dry-run mode and prints expected output', () => {
  const scriptPath = path.resolve(__dirname, '../scripts/cleanup.js');
  const output = execFileSync(process.execPath, [scriptPath, '--dry-run'], {
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test' },
  });

  assert.ok(
    output.includes('Cleanup dry run: no records will be changed.'),
    'cleanup.js --dry-run must print notice per checklist DB-4.6'
  );
  assert.ok(output.includes('"executed": false'), 'cleanup.js output must include executed: false');
});

test('identityService: readIdentityForStaff audits access, decrypts PII, and rejects unauthorized roles', async () => {
  const targetUser = await authHelper.createTestUser({ role: 'youth' });
  const realFirstName = 'Abebe';
  const realLastName = 'Bikila';
  const realEmail = 'abebe.bikila@example.test';
  const realPhone = '+251911002233';

  // Seed encrypted names into verified_identities
  await pool.query(
    `UPDATE verified_identities
     SET first_name = $1, last_name = $2, email = $3, phone = $4
     WHERE user_id = $5`,
    [
      crypto.encrypt(realFirstName),
      crypto.encrypt(realLastName),
      realEmail,
      realPhone,
      targetUser.id,
    ]
  );

  const admin = await authHelper.createTestUser({ role: 'admin' });
  const moderator = await authHelper.createTestUser({ role: 'moderator' });
  const youth = await authHelper.createTestUser({ role: 'youth' });

  // 1. Admin authorized read
  const identity = await identityService.readIdentityForStaff({
    actorId: admin.id,
    targetUserId: targetUser.id,
    reason: 'Formal legal and safeguarding review of reported user',
  });

  assert.ok(identity);
  assert.equal(identity.userId, targetUser.id);
  assert.equal(identity.firstName, realFirstName);
  assert.equal(identity.lastName, realLastName);
  assert.equal(identity.email, realEmail);
  assert.equal(identity.phone, realPhone);

  // Check that audit log row was created
  const logRows = await pool.query(
    `SELECT * FROM identity_access_log WHERE target_user_id = $1 AND actor_id = $2`,
    [targetUser.id, admin.id]
  );
  assert.equal(logRows.rows.length, 1);
  assert.equal(logRows.rows[0].reason, 'Formal legal and safeguarding review of reported user');

  // 2. Moderator unauthorized read throws 403
  await assert.rejects(
    async () => {
      await identityService.readIdentityForStaff({
        actorId: moderator.id,
        targetUserId: targetUser.id,
        reason: 'Moderator trying to view identity',
      });
    },
    (err) => err.statusCode === 403 && err.publicCode === 'FORBIDDEN'
  );

  // 3. Youth unauthorized read throws 403
  await assert.rejects(
    async () => {
      await identityService.readIdentityForStaff({
        actorId: youth.id,
        targetUserId: targetUser.id,
        reason: 'Youth trying to view identity',
      });
    },
    (err) => err.statusCode === 403 && err.publicCode === 'FORBIDDEN'
  );

  // 4. Missing reason throws 400
  await assert.rejects(
    async () => {
      await identityService.readIdentityForStaff({
        actorId: admin.id,
        targetUserId: targetUser.id,
        reason: ' ',
      });
    },
    (err) => err.statusCode === 400 && err.publicCode === 'VALIDATION_ERROR'
  );
});

test('rateLimit: responds with 429 RATE_LIMITED when rate limits are exceeded', async () => {
  // Use login route with x-test-rate-limit header to test throttling
  // We send multiple rapid requests exceeding 10 attempts
  let hitRateLimit = false;

  for (let i = 0; i < 15; i++) {
    const res = await request(app)
      .post('/api/auth/login')
      .set('x-test-rate-limit', 'true')
      .send({ identifier: 'ratelimit_test@example.test', password: 'Password123!' });

    if (res.status === 429) {
      assert.equal(res.body.error.code, 'RATE_LIMITED');
      assert.ok(res.body.error.message);
      hitRateLimit = true;
      break;
    }
  }

  assert.ok(hitRateLimit, 'Expected request to be throttled with 429 RATE_LIMITED');
});

test('otpSender: console driver strictly throws in production environment', async () => {
  await assert.rejects(
    async () => {
      await otpSender.sendOtp(
        {
          channel: 'email',
          destination: 'test@example.test',
          code: '123456',
        },
        {
          otpDriver: 'console',
          nodeEnv: 'production',
        }
      );
    },
    (err) => err.statusCode === 500 && err.publicCode === 'INTERNAL_ERROR'
  );
});

test.after(async () => {
  await db.cleanup();
});
