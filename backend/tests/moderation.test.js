
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const moderation = require('../src/services/moderationService');

const normalUser = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'user',
};

const moderator = {
  id: '22222222-2222-4222-8222-222222222222',
  role: 'moderator',
};

test('Unauthenticated users cannot submit reports', async () => {
  await assert.rejects(
    moderation.submitReport(null, {
      postId: '33333333-3333-4333-8333-333333333333',
      reason: 'Spam',
    }),
    { status: 401 }
  );
});

test('Reports must target exactly one item', async () => {
  await assert.rejects(
    moderation.submitReport(normalUser, {
      postId: '33333333-3333-4333-8333-333333333333',
      commentId: '44444444-4444-4444-8444-444444444444',
      reason: 'Spam',
    }),
    { status: 400 }
  );
});

test('Reports require a valid reason', async () => {
  await assert.rejects(
    moderation.submitReport(normalUser, {
      postId: '33333333-3333-4333-8333-333333333333',
      reason: ' ',
    }),
    { status: 400 }
  );
});

test('Users cannot report their own accounts', async () => {
  await assert.rejects(
    moderation.submitReport(normalUser, {
      reportedUserId: normalUser.id,
      reason: 'Spam',
    }),
    { status: 400 }
  );
});

test('Regular users cannot access moderation reports', async () => {
  await assert.rejects(
    moderation.getReportQueue(normalUser),
    { status: 403 }
  );
});

test('Unauthenticated users cannot access moderation reports', async () => {
  await assert.rejects(
    moderation.getReportQueue(null),
    { status: 401 }
  );
});

test('Regular users cannot moderate content', async () => {
  await assert.rejects(
    moderation.moderateContent(normalUser, {
      targetType: 'post',
      targetId: '33333333-3333-4333-8333-333333333333',
      action: 'hide_post',
    }),
    { status: 403 }
  );
});

test('Moderator actions require a valid target', async () => {
  await assert.rejects(
    moderation.moderateContent(moderator, {
      targetType: 'post',
      action: 'hide_post',
    }),
    { status: 400 }
  );
});

test('Moderator actions must use a supported action', async () => {
  await assert.rejects(
    moderation.moderateContent(moderator, {
      targetType: 'post',
      targetId: '33333333-3333-4333-8333-333333333333',
      action: 'invalid_action',
    }),
    { status: 400 }
  );
});

test('Restrictions must have a valid duration', async () => {
  await assert.rejects(
    moderation.restrictUser(
      moderator,
      normalUser.id,
      -5,
      'Repeated violations'
    ),
    { status: 400 }
  );
});
