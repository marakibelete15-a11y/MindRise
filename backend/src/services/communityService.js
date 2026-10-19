
'use strict';

const db = require('../config/db');
const posts = require('../repositories/postRepository');
const comments = require('../repositories/commentRepository');

function requireUserId(userId) {
  if (!userId) {
    const error = new Error('Authentication required');
    error.status = 401;
    throw error;
  }
}

function validateText(body, maxLength) {
  if (
    typeof body !== 'string' ||
    body.trim().length < 1 ||
    body.trim().length > maxLength
  ) {
    const error = new Error(
      `Text must contain 1-${maxLength} characters`
    );
    error.status = 400;
    throw error;
  }

  return body.trim();
}

// Check whether an account is allowed to publish.
async function assertCanParticipate(userId) {
  requireUserId(userId);

  const result = await db.query(
    `SELECT status, restricted_until
     FROM users
     WHERE id = $1`,
    [userId]
  );

  const user = result.rows[0];

  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  if (user.status !== 'active') {
    const error = new Error(
      'Your account is not currently allowed to participate'
    );
    error.status = 403;
    throw error;
  }

  if (
    user.restricted_until &&
    new Date(user.restricted_until).getTime() > Date.now()
  ) {
    const error = new Error(
      'Your account is temporarily restricted from posting and commenting'
    );
    error.status = 403;
    throw error;
  }

  return true;
}

// Community spaces and feed
async function listSpaces() {
  return posts.listSpaces();
}

async function getFeed(options = {}) {
  const limit = Number(options.limit ?? 20);
  const offset = Number(options.offset ?? 0);

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isInteger(offset) ||
    offset < 0
  ) {
    const error = new Error('Invalid pagination');
    error.status = 400;
    throw error;
  }

  return posts.listPosts({
    spaceId: options.spaceId || null,
    limit,
    offset,
  });
}

async function getPost(postId) {
  const post = await posts.getPostById(postId);

  if (!post) {
    return null;
  }

  const postComments = await comments.listComments(postId);

  return {
    ...post,
    comments: postComments,
  };
}

// Publishing remains disabled until the crisis scanner
// from Part 2 is integrated.
async function createPost() {
  throw new Error(
    'Crisis detection integration required before publishing'
  );
}

async function createComment() {
  throw new Error(
    'Crisis detection integration required before publishing'
  );
}

// Deletion
async function deletePost(postId, userId) {
  requireUserId(userId);
  return posts.deleteOwnPost(postId, userId);
}

async function deleteComment(commentId, userId) {
  requireUserId(userId);
  return comments.deleteOwnComment(commentId, userId);
}

// Reactions
async function addReaction(postId, userId) {
  requireUserId(userId);
  return posts.addReaction(postId, userId);
}

async function removeReaction(postId, userId) {
  requireUserId(userId);
  return posts.removeReaction(postId, userId);
}

module.exports = {
  listSpaces,
  getFeed,
  getPost,
  createPost,
  createComment,
  deletePost,
  deleteComment,
  addReaction,
  removeReaction,
  validateText,
  assertCanParticipate,
};
