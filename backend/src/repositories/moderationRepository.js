
'use strict';

const db = require('../config/db');

// Submit a report about a post, comment, or user.
async function createReport({
  reporterId,
  postId = null,
  commentId = null,
  reportedUserId = null,
  reason,
  details = null,
}) {
  const result = await db.query(
    `INSERT INTO content_reports
       (reporter_id, post_id, comment_id,
        reported_user_id, reason, details)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING
     RETURNING id, reporter_id, post_id, comment_id,
               reported_user_id, reason, status, created_at`,
    [
      reporterId,
      postId,
      commentId,
      reportedUserId,
      reason,
      details,
    ]
  );

  return result.rows[0] || null;
}

// List reports awaiting moderator review.
async function listReports({ limit = 20, offset = 0 } = {}) {
  const result = await db.query(
    `SELECT id, reporter_id, post_id, comment_id,
            reported_user_id, reason, details,
            status, assigned_to, created_at
     FROM content_reports
     WHERE status IN ('open', 'reviewing')
     ORDER BY created_at ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return result.rows;
}

// Retrieve one report.
async function getReportById(reportId) {
  const result = await db.query(
    `SELECT *
     FROM content_reports
     WHERE id = $1`,
    [reportId]
  );

  return result.rows[0] || null;
}

// Change a report's review status.
async function updateReportStatus(reportId, status, moderatorId) {
  const result = await db.query(
    `UPDATE content_reports
     SET status = $2::report_status,
         assigned_to = $3,
         resolved_at = CASE
           WHEN $2 IN ('resolved', 'dismissed') THEN NOW()
           ELSE NULL
         END
     WHERE id = $1
     RETURNING *`,
    [reportId, status, moderatorId]
  );

  return result.rows[0] || null;
}

// Hide, restore, or remove a post.
async function updatePostStatus(postId, status) {
  const result = await db.query(
    `UPDATE community_posts
     SET status = $2::community_post_status,
         updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id, status`,
    [postId, status]
  );

  return result.rows[0] || null;
}

// Hide, restore, or remove a comment.
async function updateCommentStatus(commentId, status) {
  const result = await db.query(
    `UPDATE community_comments
     SET status = $2::community_post_status,
         updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id, status`,
    [commentId, status]
  );

  return result.rows[0] || null;
}

// Temporarily restrict a user's account.
async function restrictUser(userId, until, reason) {
  const result = await db.query(
    `UPDATE users
     SET restricted_until = $2,
         restriction_reason = $3
     WHERE id = $1
     RETURNING id, restricted_until, restriction_reason`,
    [userId, until, reason]
  );

  return result.rows[0] || null;
}

// Reverse a temporary restriction.
async function unrestrictUser(userId) {
  const result = await db.query(
    `UPDATE users
     SET restricted_until = NULL,
         restriction_reason = NULL
     WHERE id = $1
     RETURNING id, restricted_until`,
    [userId]
  );

  return result.rows[0] || null;
}

// Store an audit record for moderator actions.
async function recordAction({
  moderatorId,
  reportId = null,
  postId = null,
  commentId = null,
  targetUserId = null,
  action,
  reason = null,
}) {
  const result = await db.query(
    `INSERT INTO moderation_actions
       (moderator_id, report_id, post_id,
        comment_id, target_user_id, action, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      moderatorId,
      reportId,
      postId,
      commentId,
      targetUserId,
      action,
      reason,
    ]
  );

  return result.rows[0];
}

// View moderation history.
async function listActions({ limit = 20, offset = 0 } = {}) {
  const result = await db.query(
    `SELECT id, moderator_id, report_id, post_id,
            comment_id, target_user_id, action,
            reason, created_at
     FROM moderation_actions
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return result.rows;
}

// Count distinct reporters within a time window.
async function countRecentReports({
  postId = null,
  commentId = null,
  reportedUserId = null,
  hours = 24,
}) {
  const result = await db.query(
    `SELECT COUNT(DISTINCT reporter_id)::int AS count
     FROM content_reports
     WHERE created_at >= NOW() - ($4::int * INTERVAL '1 hour')
       AND (
         ($1::uuid IS NOT NULL AND post_id = $1)
         OR ($2::uuid IS NOT NULL AND comment_id = $2)
         OR ($3::uuid IS NOT NULL AND reported_user_id = $3)
       )`,
    [postId, commentId, reportedUserId, hours]
  );

  return result.rows[0].count;
}

module.exports = {
  createReport,
  listReports,
  getReportById,
  updateReportStatus,
  updatePostStatus,
  updateCommentStatus,
  restrictUser,
  unrestrictUser,
  recordAction,
  listActions,
  countRecentReports,
};
