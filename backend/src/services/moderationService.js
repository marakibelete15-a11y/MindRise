
'use strict';

const db = require('../config/db');
const repo = require('../repositories/moderationRepository');
const moderationConfig = require('../config/moderation');

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function requireModerator(user) {
  if (!user || !user.id) {
    fail('Authentication required', 401);
  }

  if (!['moderator', 'admin'].includes(user.role)) {
    fail('Moderator access required', 403);
  }
}

function checkPagination({ limit = 20, offset = 0 } = {}) {
  limit = Number(limit);
  offset = Number(offset);

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isInteger(offset) ||
    offset < 0
  ) {
    fail('Invalid pagination');
  }

  return { limit, offset };
}

// Apply an automatic restriction when reports exceed the threshold.
// The user row is locked to prevent competing restriction updates.
async function applyAutomaticRestriction(targetUserId, reportTarget) {
  if (!targetUserId) {
    return null;
  }

  return db.withTransaction(async (client) => {
    const userResult = await client.query(
      `SELECT id, role, status, restricted_until, restriction_reason
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [targetUserId]
    );

    const target = userResult.rows[0];

    if (!target || target.role !== 'youth' || target.status !== 'active') {
      return null;
    }

    // Do not overwrite an existing active restriction.
    if (
      target.restricted_until &&
      new Date(target.restricted_until).getTime() > Date.now()
    ) {
      return null;
    }

    const countResult = await client.query(
      `SELECT COUNT(DISTINCT reporter_id)::int AS count
       FROM content_reports
       WHERE created_at >= NOW() -
         ($4::int * INTERVAL '1 hour')
         AND (
           ($1::uuid IS NOT NULL AND post_id = $1)
           OR ($2::uuid IS NOT NULL AND comment_id = $2)
           OR ($3::uuid IS NOT NULL AND reported_user_id = $3)
         )`,
      [
        reportTarget.postId || null,
        reportTarget.commentId || null,
        reportTarget.reportedUserId || null,
        moderationConfig.reportWindowHours,
      ]
    );

    const count = countResult.rows[0].count;

    if (count <= moderationConfig.reportThreshold) {
      return null;
    }

    const until = new Date(
      Date.now() + moderationConfig.restrictionHours * 60 * 60 * 1000
    );

    const reason =
      'Automatic community safety restriction pending moderator review';

    const result = await client.query(
      `UPDATE users
       SET restricted_until = $2,
           restriction_reason = $3
       WHERE id = $1
       RETURNING id, restricted_until, restriction_reason`,
      [targetUserId, until, reason]
    );

    return result.rows[0] || null;
  });
}

// Submit a report about one post, comment, or account.
async function submitReport(user, data) {
  if (!user || !user.id) {
    fail('Authentication required', 401);
  }

  if (!data || typeof data !== 'object') {
    fail('Report details are required');
  }

  const targets = [
    data.postId,
    data.commentId,
    data.reportedUserId,
  ].filter(Boolean);

  if (targets.length !== 1) {
    fail('Choose exactly one report target');
  }

  if (
    typeof data.reason !== 'string' ||
    data.reason.trim().length < 2 ||
    data.reason.trim().length > 100
  ) {
    fail('Reason must contain 2-100 characters');
  }

  if (
    data.details != null &&
    (
      typeof data.details !== 'string' ||
      data.details.length > 2000
    )
  ) {
    fail('Details must be 2000 characters or fewer');
  }

  if (data.reportedUserId === user.id) {
    fail('You cannot report your own account');
  }

  const reportTarget = {
    postId: data.postId || null,
    commentId: data.commentId || null,
    reportedUserId: data.reportedUserId || null,
  };

  // Resolve the content owner before accepting a report.
  const targetUserId = await repo.getReportedAccountId(reportTarget);

  if (!targetUserId) {
    fail('Report target not found', 404);
  }

  if (targetUserId === user.id) {
    fail('You cannot report your own content');
  }

  const report = await repo.createReport({
    reporterId: user.id,
    ...reportTarget,
    reason: data.reason.trim(),
    details: data.details || null,
  });

  if (!report) {
    fail('You have already reported this target', 409);
  }

  await applyAutomaticRestriction(targetUserId, reportTarget);

  return report;
}

// Retrieve the moderator's pending report queue.
async function getReportQueue(user, options = {}) {
  requireModerator(user);
  return repo.listReports(checkPagination(options));
}

// Retrieve moderation audit history.
async function getModerationHistory(user, options = {}) {
  requireModerator(user);
  return repo.listActions(checkPagination(options));
}

// Retrieve one report for moderator review.
async function getReport(user, reportId) {
  requireModerator(user);

  const report = await repo.getReportById(reportId);

  if (!report) {
    fail('Report not found', 404);
  }

  return report;
}

function validateContentAction(targetType, action) {
  const actions = {
    post: {
      hide_post: 'hidden',
      restore_post: 'visible',
      remove_post: 'removed',
    },
    comment: {
      hide_comment: 'hidden',
      restore_comment: 'visible',
      remove_comment: 'removed',
    },
  };

  const status = actions[targetType]?.[action];

  if (!status) {
    fail('Invalid moderation action');
  }

  return status;
}

// Hide, restore, or remove reported content.
async function moderateContent(
  user,
  {
    targetType,
    targetId,
    action,
    reason = null,
    reportId = null,
  }
) {
  requireModerator(user);

  if (!targetId) {
    fail('Content ID is required');
  }

  const status = validateContentAction(targetType, action);

  const updated = targetType === 'post'
    ? await repo.updatePostStatus(targetId, status)
    : await repo.updateCommentStatus(targetId, status);

  if (!updated) {
    fail('Content not found', 404);
  }

  await repo.recordAction({
    moderatorId: user.id,
    reportId,
    postId: targetType === 'post' ? targetId : null,
    commentId: targetType === 'comment' ? targetId : null,
    action,
    reason,
  });

  return updated;
}

// Dismiss a report.
async function dismissReport(user, reportId, reason = null) {
  requireModerator(user);

  const report = await repo.getReportById(reportId);

  if (!report) {
    fail('Report not found', 404);
  }

  const updated = await repo.updateReportStatus(
    reportId,
    'dismissed',
    user.id
  );

  await repo.recordAction({
    moderatorId: user.id,
    reportId,
    action: 'dismiss_report',
    reason,
  });

  return updated;
}

// Manually restrict an account.
async function restrictUser(user, targetUserId, hours, reason) {
  requireModerator(user);

  const duration = Number(hours);

  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 720
  ) {
    fail('Restriction duration must be 1-720 hours');
  }

  if (!targetUserId || targetUserId === user.id) {
    fail('Invalid target user');
  }

  const until = new Date(Date.now() + duration * 3600000);

  const updated = await repo.restrictUser(
    targetUserId,
    until,
    reason || 'Community safety restriction'
  );

  if (!updated) {
    fail('User not found', 404);
  }

  await repo.recordAction({
    moderatorId: user.id,
    targetUserId,
    action: 'restrict_user',
    reason,
  });

  return updated;
}

// Reverse a restriction.
async function unrestrictUser(user, targetUserId, reason = null) {
  requireModerator(user);

  if (!targetUserId) {
    fail('Invalid target user');
  }

  const updated = await repo.unrestrictUser(targetUserId);

  if (!updated) {
    fail('User not found', 404);
  }

  await repo.recordAction({
    moderatorId: user.id,
    targetUserId,
    action: 'unrestrict_user',
    reason,
  });

  return updated;
}

module.exports = {
  submitReport,
  getReportQueue,
  getModerationHistory,
  getReport,
  moderateContent,
  dismissReport,
  restrictUser,
  unrestrictUser,
  applyAutomaticRestriction,
};
