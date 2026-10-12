'use strict';

// Public response serializers. SRS FR-1.3, FR-4.5, 5.4. TODO: define full allowlists.
module.exports = {
  publicProfile(profile) { return { alias: profile.alias, avatarUrl: profile.avatarUrl }; },
  publicPost(post) {
    return {
      id: post.id,
      body: post.body,
      status: post.status,
      isAnonymous: post.is_anonymous,
      createdAt: post.created_at,
      spaceId: post.space_id,
    };
  },
};