
'use strict';

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

// Submit a community report.
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

  const report = await repo.createReport({
    reporterId: user.id,
    postId: data.postId || null,
    commentId: data.commentId || null,
    reportedUserId: data.reportedUserId || null,
    reason: data.reason.trim(),
    details: data.details || null,
  });

  if (!report) {
    fail('You have already reported this target', 409);
  }

  // Count distinct reporters within the configured time window.
  const reportCount = await repo.countRecentReports({
    postId: data.postId || null,
    commentId: data.commentId || null,
    reportedUserId: data.reportedUserId || null,
    hours: moderationConfig.reportWindowHours,
  });

  // FR-7.5: Restrict accounts when the configured threshold
  // is exceeded. Enforcement is not implemented yet.
  //
  // Before enabling it, we must identify the author of
  // reported posts/comments and apply the restriction safely.
  if (reportCount > moderationConfig.reportThreshold) {
    // Automatic restriction processing pending.
  }

  return report;
}

// Moderator report queue.
async function getReportQueue(user, options = {}) {
  requireModerator(user);
  return repo.listReports(checkPagination(options));
}

// Moderator audit history.
async function getModerationHistory(user, options = {}) {
  requireModerator(user);
  return repo.listActions(checkPagination(options));
}

// View one report.
async function getReport(user, reportId) {
  requireModerator(user);

  const report = await repo.getReportById(reportId);

  if (!report) {
    fail('Report not found', 404);
  }

  return report;
}

// Validate content moderation action.
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

// Moderate a community post or comment.
// NOTE: Transaction required before exposing via HTTP.
async function moderateContent(user, {
  targetType,
  targetId,
  action,
  reason = null,
  reportId = null,
}) {
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
// NOTE: Transaction required before exposing via HTTP.
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

// Restrict a user temporarily.
// NOTE: Transaction required before exposing via HTTP.
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

// Reverse a temporary restriction.
// NOTE: Transaction required before exposing via HTTP.
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
};
