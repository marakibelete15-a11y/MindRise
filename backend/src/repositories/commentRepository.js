
'use strict';

const db = require('../config/db');

async function listComments(postId) {
  const result = await db.query(
    `SELECT c.id, c.post_id, c.parent_comment_id,
            c.body, c.created_at,
            pr.alias AS handle,
            pr.avatar_path AS avatar_url
     FROM community_comments c
     JOIN community_posts p ON p.id = c.post_id
     LEFT JOIN profiles pr ON pr.user_id = c.author_id
     WHERE c.post_id = $1
       AND c.status = 'visible'
       AND c.deleted_at IS NULL
       AND p.status = 'visible'
       AND p.deleted_at IS NULL
     ORDER BY c.created_at ASC`,
    [postId]
  );

  return result.rows;
}

async function createComment({
  postId,
  authorId,
  body,
  parentCommentId = null,
}) {
  const result = await db.query(
    `INSERT INTO community_comments
       (post_id, author_id, body, parent_comment_id)
     SELECT p.id, $2, $3, $4
     FROM community_posts p
     WHERE p.id = $1
       AND p.status = 'visible'
       AND p.deleted_at IS NULL
     RETURNING id, post_id, body, created_at`,
    [postId, authorId, body, parentCommentId]
  );

  return result.rows[0] || null;
}

async function deleteOwnComment(commentId, authorId) {
  const result = await db.query(
    `UPDATE community_comments
     SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1
       AND author_id = $2
       AND deleted_at IS NULL
     RETURNING id`,
    [commentId, authorId]
  );

  return result.rows[0] || null;
}

module.exports = {
  listComments,
  createComment,
  deleteOwnComment,
};
