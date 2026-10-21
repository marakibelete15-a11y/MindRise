
'use strict';

const db = require('../config/db');

async function listSpaces() {
  const result = await db.query(
    `SELECT id, slug, title, description, translations
     FROM community_spaces
     WHERE is_active = true
     ORDER BY title ASC`
  );
  return result.rows;
}

async function listPosts({ spaceId = null, limit = 20, offset = 0 } = {}) {
  const result = await db.query(
    `SELECT p.id, p.space_id, p.body, p.is_anonymous,
            p.created_at,
            CASE WHEN p.is_anonymous THEN NULL ELSE pr.alias END AS handle,
            CASE WHEN p.is_anonymous THEN NULL ELSE pr.avatar_path END AS avatar_url,
            (SELECT COUNT(*)::int FROM post_reactions r
             WHERE r.post_id = p.id) AS support_count
     FROM community_posts p
     LEFT JOIN profiles pr ON pr.user_id = p.author_id
     WHERE p.status = 'visible'
       AND p.deleted_at IS NULL
       AND ($1::uuid IS NULL OR p.space_id = $1::uuid)
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT $2 OFFSET $3`,
    [spaceId, limit, offset]
  );
  return result.rows;
}

async function getPostById(postId) {
  const result = await db.query(
    `SELECT p.id, p.space_id, p.body, p.is_anonymous,
            p.created_at,
            CASE WHEN p.is_anonymous THEN NULL ELSE pr.alias END AS handle,
            CASE WHEN p.is_anonymous THEN NULL ELSE pr.avatar_path END AS avatar_url
     FROM community_posts p
     LEFT JOIN profiles pr ON pr.user_id = p.author_id
     WHERE p.id = $1
       AND p.status = 'visible'
       AND p.deleted_at IS NULL`,
    [postId]
  );
  return result.rows[0] || null;
}

async function createPost({ authorId, spaceId, body, isAnonymous = true }) {
  const result = await db.query(
    `INSERT INTO community_posts
       (author_id, space_id, body, is_anonymous)
     VALUES ($1, $2, $3, $4)
     RETURNING id, space_id, body, is_anonymous, created_at`,
    [authorId, spaceId, body, isAnonymous]
  );
  return result.rows[0];
}

async function deleteOwnPost(postId, authorId) {
  const result = await db.query(
    `UPDATE community_posts
     SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1
       AND author_id = $2
       AND deleted_at IS NULL
     RETURNING id`,
    [postId, authorId]
  );
  return result.rows[0] || null;
}

async function addReaction(postId, userId) {
  const result = await db.query(
    `INSERT INTO post_reactions (post_id, user_id, kind)
     SELECT p.id, $2, 'support'
     FROM community_posts p
     WHERE p.id = $1
       AND p.status = 'visible'
       AND p.deleted_at IS NULL
     ON CONFLICT DO NOTHING
     RETURNING post_id, kind`,
    [postId, userId]
  );
  return result.rows[0] || null;
}

async function removeReaction(postId, userId) {
  const result = await db.query(
    `DELETE FROM post_reactions
     WHERE post_id = $1 AND user_id = $2 AND kind = 'support'
     RETURNING post_id`,
    [postId, userId]
  );
  return result.rows[0] || null;
}

module.exports = {
  listSpaces,
  listPosts,
  getPostById,
  createPost,
  deleteOwnPost,
  addReaction,
  removeReaction,
};
