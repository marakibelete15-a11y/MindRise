
'use strict';

const express = require('express');
const community = require('../services/communityService');

const router = express.Router();

function sendError(error, response, next) {
  if (error.status && error.status >= 400 && error.status < 500) {
    return response.status(error.status).json({
      error: error.message,
    });
  }

  return next(error);
}

// GET /api/community/spaces
// List active community spaces.
router.get('/community/spaces', async (_request, response, next) => {
  try {
    const spaces = await community.listSpaces();
    response.json({ spaces });
  } catch (error) {
    sendError(error, response, next);
  }
});

// GET /api/community/posts?spaceId=...&limit=20&offset=0
// Paginated community feed.
router.get('/community/posts', async (request, response, next) => {
  try {
    const posts = await community.getFeed({
      spaceId: request.query.spaceId,
      limit: request.query.limit,
      offset: request.query.offset,
    });

    response.json({ posts });
  } catch (error) {
    sendError(error, response, next);
  }
});

// GET /api/community/posts/:postId
// View a visible post and its visible comments.
router.get('/community/posts/:postId', async (request, response, next) => {
  try {
    const post = await community.getPost(request.params.postId);

    if (!post) {
      return response.status(404).json({
        error: 'Post not found',
      });
    }

    response.json({ post });
  } catch (error) {
    sendError(error, response, next);
  }
});

module.exports = router;
