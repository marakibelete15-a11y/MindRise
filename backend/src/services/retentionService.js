'use strict';

// Scheduled retention and cleanup service. SRS 5.4, FR-5.4, FR-7.x.
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const pool = require('../config/db');
const { withTransaction } = require('../config/db');
const env = require('../config/env');
const avatarStorage = require('./avatarStorage');

/**
 * Executes or simulates retention cleanup policies across the database and filesystem.
 * SRS 5.4, FR-5.4, database/docs/retention-and-cleanup.md.
 *
 * @param {object} options
 * @param {Date} [options.now] - Injectable current timestamp (default: new Date())
 * @param {boolean} [options.execute] - Live run if true; dry-run preview if false (default: false)
 * @param {number} [options.batchSize] - Bounded batch limit for chunked deletions (default: 500)
 * @param {string} [options.uploadDir] - Custom upload directory for testing
 * @returns {Promise<object>} Summary statistics of cleaned or candidate records
 */
async function cleanup({
  now = new Date(),
  execute = false,
  batchSize = 500,
  uploadDir = null,
} = {}) {
  const currentTime = now instanceof Date ? now : new Date(now);
  const results = {
    executed: execute,
    timestamp: currentTime.toISOString(),
    verificationChallenges: { count: 0 },
    accountsPurged: { count: 0 },
    removedPosts: { count: 0 },
    removedComments: { count: 0 },
    closedReports: { count: 0 },
    moderationActions: { count: 0 },
    identityAccessLogs: { count: 0 },
    orphanAvatars: { count: 0 },
  };

  // 1. Verification Challenges: Expired or consumed > 24 hours
  const challengeCutoff = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000);
  if (!execute) {
    const q = await pool.query(
      `SELECT count(*)::int AS count FROM verification_challenges
       WHERE (consumed_at IS NOT NULL AND consumed_at <= $1)
          OR (consumed_at IS NULL AND expires_at <= $1)`,
      [challengeCutoff]
    );
    results.verificationChallenges.count = q.rows[0].count;
  } else {
    let deletedTotal = 0;
    while (true) {
      const res = await pool.query(
        `DELETE FROM verification_challenges
         WHERE id IN (
           SELECT id FROM verification_challenges
           WHERE (consumed_at IS NOT NULL AND consumed_at <= $1)
              OR (consumed_at IS NULL AND expires_at <= $1)
           LIMIT $2
         )`,
        [challengeCutoff, batchSize]
      );
      deletedTotal += res.rowCount;
      if (res.rowCount === 0 || res.rowCount < batchSize) break;
    }
    results.verificationChallenges.count = deletedTotal;
  }

  // 2. Account Deletion: deletion_pending > 30 days
  const accountCutoff = new Date(currentTime.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (!execute) {
    const q = await pool.query(
      `SELECT count(*)::int AS count FROM users
       WHERE status = 'deletion_pending' AND deleted_at <= $1`,
      [accountCutoff]
    );
    results.accountsPurged.count = q.rows[0].count;
  } else {
    let purgedTotal = 0;
    while (true) {
      const candidates = await pool.query(
        `SELECT u.id, p.avatar_path
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.status = 'deletion_pending' AND u.deleted_at <= $1
         LIMIT $2`,
        [accountCutoff, batchSize]
      );

      if (candidates.rows.length === 0) break;

      const userIds = candidates.rows.map((r) => r.id);

      // Clean up avatar files from disk
      for (const row of candidates.rows) {
        if (row.avatar_path) {
          await avatarStorage.remove(row.avatar_path);
        }
      }

      // Delete users in a transaction (cascades profiles, verified_identities, stats, settings, etc.)
      await withTransaction(async (client) => {
        await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [userIds]);
      });

      purgedTotal += userIds.length;
      if (candidates.rows.length < batchSize) break;
    }
    results.accountsPurged.count = purgedTotal;
  }

  // 3. Removed Community Posts: status = 'removed' > 90 days
  const contentCutoff = new Date(currentTime.getTime() - 90 * 24 * 60 * 60 * 1000);
  if (!execute) {
    const q = await pool.query(
      `SELECT count(*)::int AS count FROM community_posts
       WHERE status = 'removed' AND (deleted_at <= $1 OR (deleted_at IS NULL AND updated_at <= $1))`,
      [contentCutoff]
    );
    results.removedPosts.count = q.rows[0].count;
  } else {
    let deletedTotal = 0;
    while (true) {
      const res = await pool.query(
        `DELETE FROM community_posts
         WHERE id IN (
           SELECT id FROM community_posts
           WHERE status = 'removed' AND (deleted_at <= $1 OR (deleted_at IS NULL AND updated_at <= $1))
           LIMIT $2
         )`,
        [contentCutoff, batchSize]
      );
      deletedTotal += res.rowCount;
      if (res.rowCount === 0 || res.rowCount < batchSize) break;
    }
    results.removedPosts.count = deletedTotal;
  }

  // 4. Removed Community Comments: status = 'removed' > 90 days
  if (!execute) {
    const q = await pool.query(
      `SELECT count(*)::int AS count FROM community_comments
       WHERE status = 'removed' AND (deleted_at <= $1 OR (deleted_at IS NULL AND updated_at <= $1))`,
      [contentCutoff]
    );
    results.removedComments.count = q.rows[0].count;
  } else {
    let deletedTotal = 0;
    while (true) {
      const res = await pool.query(
        `DELETE FROM community_comments
         WHERE id IN (
           SELECT id FROM community_comments
           WHERE status = 'removed' AND (deleted_at <= $1 OR (deleted_at IS NULL AND updated_at <= $1))
           LIMIT $2
         )`,
        [contentCutoff, batchSize]
      );
      deletedTotal += res.rowCount;
      if (res.rowCount === 0 || res.rowCount < batchSize) break;
    }
    results.removedComments.count = deletedTotal;
  }

  // 5. Closed Content Reports: status IN ('resolved', 'dismissed') > 12 months (365 days)
  const auditCutoff = new Date(currentTime.getTime() - 365 * 24 * 60 * 60 * 1000);
  if (!execute) {
    const q = await pool.query(
      `SELECT count(*)::int AS count FROM content_reports
       WHERE status IN ('resolved', 'dismissed')
         AND (resolved_at <= $1 OR (resolved_at IS NULL AND created_at <= $1))`,
      [auditCutoff]
    );
    results.closedReports.count = q.rows[0].count;
  } else {
    let deletedTotal = 0;
    while (true) {
      const res = await pool.query(
        `DELETE FROM content_reports
         WHERE id IN (
           SELECT id FROM content_reports
           WHERE status IN ('resolved', 'dismissed')
             AND (resolved_at <= $1 OR (resolved_at IS NULL AND created_at <= $1))
           LIMIT $2
         )`,
        [auditCutoff, batchSize]
      );
      deletedTotal += res.rowCount;
      if (res.rowCount === 0 || res.rowCount < batchSize) break;
    }
    results.closedReports.count = deletedTotal;
  }

  // 6. Moderation Actions > 12 months (365 days)
  if (!execute) {
    const q = await pool.query(
      `SELECT count(*)::int AS count FROM moderation_actions WHERE created_at <= $1`,
      [auditCutoff]
    );
    results.moderationActions.count = q.rows[0].count;
  } else {
    let deletedTotal = 0;
    while (true) {
      const res = await pool.query(
        `DELETE FROM moderation_actions
         WHERE id IN (
           SELECT id FROM moderation_actions WHERE created_at <= $1 LIMIT $2
         )`,
        [auditCutoff, batchSize]
      );
      deletedTotal += res.rowCount;
      if (res.rowCount === 0 || res.rowCount < batchSize) break;
    }
    results.moderationActions.count = deletedTotal;
  }

  // 7. Identity Access Log > 12 months (365 days)
  if (!execute) {
    const q = await pool.query(
      `SELECT count(*)::int AS count FROM identity_access_log WHERE created_at <= $1`,
      [auditCutoff]
    );
    results.identityAccessLogs.count = q.rows[0].count;
  } else {
    let deletedTotal = 0;
    while (true) {
      const res = await pool.query(
        `DELETE FROM identity_access_log
         WHERE id IN (
           SELECT id FROM identity_access_log WHERE created_at <= $1 LIMIT $2
         )`,
        [auditCutoff, batchSize]
      );
      deletedTotal += res.rowCount;
      if (res.rowCount === 0 || res.rowCount < batchSize) break;
    }
    results.identityAccessLogs.count = deletedTotal;
  }

  // 8. Orphan Avatar Files in uploads > 24 hours not referenced by any profile
  const avatarDir = path.resolve(uploadDir || env.uploadDir);
  const avatarCutoff = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000);

  if (fs.existsSync(avatarDir)) {
    try {
      const activeRows = await pool.query(
        `SELECT avatar_path FROM profiles WHERE avatar_path IS NOT NULL`
      );
      const activeFilenames = new Set(
        activeRows.rows.map((r) => path.basename(r.avatar_path))
      );

      const files = await fsPromises.readdir(avatarDir);
      let orphanCount = 0;

      for (const file of files) {
        if (!file.endsWith('.webp')) continue;

        const filePath = path.join(avatarDir, file);
        try {
          const stats = await fsPromises.stat(filePath);
          if (stats.mtime <= avatarCutoff && !activeFilenames.has(file)) {
            orphanCount++;
            if (execute) {
              await fsPromises.unlink(filePath);
            }
          }
        } catch (_statErr) {
          // File may have been removed concurrently
        }
      }
      results.orphanAvatars.count = orphanCount;
    } catch (fsErr) {
      console.warn(`[Retention] Avatar filesystem cleanup warning: ${fsErr.message}`);
    }
  }

  return results;
}

module.exports = {
  cleanup,
};