CREATE INDEX crisis_flags_user_idx ON crisis_flags (user_id);
-- Supports each user's crisis history and user-delete cascades.
CREATE INDEX crisis_flags_open_queue_idx ON crisis_flags (created_at ASC)
    WHERE status IN ('open', 'reviewing');
-- Surfaces the oldest unresolved safety flags first.
CREATE INDEX crisis_flags_assigned_to_idx ON crisis_flags (assigned_to);
-- Finds flags assigned to a moderator and supports SET NULL updates.
CREATE INDEX crisis_flags_attempt_idx ON crisis_flags (attempt_id);
-- Supports assessment-attempt reference checks and SET NULL updates.
CREATE INDEX crisis_flags_post_idx ON crisis_flags (post_id);
-- Supports post reference checks and SET NULL updates.
CREATE INDEX crisis_flags_comment_idx ON crisis_flags (comment_id);
-- Supports comment reference checks and SET NULL updates.
CREATE INDEX crisis_flags_unacknowledged_user_idx ON crisis_flags (user_id, created_at ASC)
    WHERE user_acknowledged_at IS NULL;
-- Finds unacknowledged safety flags for a user.
CREATE INDEX community_posts_space_fk_idx ON community_posts (space_id);
-- Supports space foreign-key restriction checks for posts in every status.
CREATE INDEX community_posts_space_feed_idx ON community_posts (space_id, created_at DESC)
    WHERE status = 'visible' AND deleted_at IS NULL;
-- Loads visible posts newest-first within a topic space.
CREATE INDEX post_reactions_user_idx ON post_reactions (user_id);
-- Supports reaction lookup and user-delete cascades.
CREATE INDEX content_reports_reported_user_created_idx ON content_reports (reported_user_id, created_at DESC)
    WHERE reported_user_id IS NOT NULL;
-- Supports distinct-reporter counts for reported accounts within time windows.
CREATE INDEX users_restricted_until_idx ON users (restricted_until)
    WHERE restricted_until IS NOT NULL;
-- Finds accounts whose temporary posting restriction has expired.
CREATE INDEX identity_access_log_target_timeline_idx ON identity_access_log (target_user_id, created_at DESC);
-- Audits access to a specific user's restricted identity record.
CREATE INDEX identity_access_log_actor_idx ON identity_access_log (actor_id);
-- Supports actor audit lookup and SET NULL updates.