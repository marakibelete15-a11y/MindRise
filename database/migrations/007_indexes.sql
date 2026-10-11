CREATE INDEX users_created_timeline_idx ON users (created_at DESC); -- Supports account age sorting in the moderator dashboard.
CREATE INDEX users_updated_timeline_idx ON users (updated_at DESC); -- Supports recently updated account sorting in the moderator dashboard.
CREATE INDEX profiles_created_timeline_idx ON profiles (created_at DESC); -- Supports profile creation audit ordering.
CREATE INDEX profiles_updated_timeline_idx ON profiles (updated_at DESC); -- Supports recently updated profile ordering.
CREATE INDEX verification_challenges_user_idx ON verification_challenges (user_id); -- Supports challenge lookup and user-delete cascades.
CREATE INDEX verification_challenges_expiry_idx ON verification_challenges (expires_at); -- Finds expired challenges for cleanup.
CREATE INDEX verification_challenges_created_idx ON verification_challenges (created_at DESC); -- Supports recent verification audit views.
CREATE INDEX assessment_types_created_idx ON assessment_types (created_at DESC); -- Supports recently added assessment catalog views.
CREATE INDEX assessment_versions_type_idx ON assessment_versions (assessment_type_id); -- Supports version lookup and type-delete restriction checks.
CREATE INDEX assessment_versions_created_idx ON assessment_versions (created_at DESC); -- Supports recent assessment-version audit views.
CREATE INDEX assessment_questions_version_idx ON assessment_questions (assessment_version_id); -- Supports question lookup and version-delete cascades.
CREATE INDEX assessment_questions_created_idx ON assessment_questions (created_at DESC); -- Supports question change history views.
CREATE INDEX assessment_attempts_user_timeline_idx ON assessment_attempts (user_id, started_at DESC); -- Loads a user's assessment history in order.
CREATE INDEX assessment_attempts_completed_timeline_idx ON assessment_attempts (completed_at DESC) WHERE completed_at IS NOT NULL; -- Loads completed assessment results newest first.
CREATE INDEX assessment_attempts_version_idx ON assessment_attempts (assessment_version_id); -- Supports version usage lookup and delete restriction checks.
CREATE INDEX assessment_answers_question_idx ON assessment_answers (question_id); -- Supports question reference checks and answer analysis.
CREATE INDEX assessment_answers_created_idx ON assessment_answers (created_at DESC); -- Supports answer history ordering within an attempt.

CREATE INDEX user_goals_user_timeline_idx ON user_goals (user_id, created_at DESC); -- Loads a user's goals by recency.
CREATE INDEX user_goals_routine_idx ON user_goals (routine_id); -- Supports routine lookup and SET NULL updates.
CREATE INDEX routines_created_timeline_idx ON routines (created_at DESC); -- Supports routine catalog recency sorting.
CREATE INDEX routine_completions_user_timeline_idx ON routine_completions (user_id, completed_on DESC); -- Loads a user's completion history by day.
CREATE INDEX routine_completions_routine_idx ON routine_completions (routine_id); -- Supports routine lookup and SET NULL updates.
CREATE INDEX routine_completions_goal_idx ON routine_completions (goal_id); -- Supports goal lookup and SET NULL updates.
CREATE INDEX user_streaks_routine_idx ON user_streaks (routine_id); -- Supports routine lookup and cascade deletion.
CREATE INDEX user_streaks_updated_idx ON user_streaks (updated_at DESC); -- Supports recently updated streak dashboard views.
CREATE INDEX badges_created_idx ON badges (created_at DESC); -- Supports badge catalog recency sorting.
CREATE INDEX user_badges_badge_idx ON user_badges (badge_id); -- Supports badge lookup and delete restriction checks.
CREATE INDEX user_badges_awarded_idx ON user_badges (awarded_at DESC); -- Loads recently awarded badges.

CREATE INDEX community_posts_feed_idx ON community_posts (created_at DESC) WHERE status = 'visible' AND deleted_at IS NULL; -- Loads the visible community feed newest first.
CREATE INDEX community_posts_author_idx ON community_posts (author_id); -- Supports author lookup and SET NULL updates.
CREATE INDEX community_posts_updated_idx ON community_posts (updated_at DESC); -- Supports recent post edit/moderation views.
CREATE INDEX community_comments_post_timeline_idx ON community_comments (post_id, created_at DESC); -- Loads comments in chronological order per post.
CREATE INDEX community_comments_author_idx ON community_comments (author_id); -- Supports author lookup and SET NULL updates.
CREATE INDEX community_comments_parent_idx ON community_comments (parent_comment_id); -- Supports reply lookup and SET NULL updates.
CREATE INDEX community_comments_updated_idx ON community_comments (updated_at DESC); -- Supports recent comment edit/moderation views.
CREATE INDEX content_reports_reporter_idx ON content_reports (reporter_id); -- Supports reporter lookup and SET NULL updates.
CREATE INDEX content_reports_post_idx ON content_reports (post_id); -- Supports reports by post and post-delete cascades.
CREATE INDEX content_reports_comment_idx ON content_reports (comment_id); -- Supports reports by comment and comment-delete cascades.
CREATE INDEX content_reports_assignee_idx ON content_reports (assigned_to); -- Supports moderator work assignment lookup.
CREATE INDEX content_reports_queue_idx ON content_reports (created_at ASC) WHERE status IN ('open', 'reviewing'); -- Prioritizes oldest unresolved moderation reports.
CREATE INDEX content_reports_resolved_idx ON content_reports (resolved_at DESC) WHERE resolved_at IS NOT NULL; -- Supports resolved-report history sorting.

CREATE INDEX moderation_actions_moderator_timeline_idx ON moderation_actions (moderator_id, created_at DESC); -- Loads each moderator's audit history.
CREATE INDEX moderation_actions_report_idx ON moderation_actions (report_id); -- Supports report audit lookup and SET NULL updates.
CREATE INDEX moderation_actions_post_idx ON moderation_actions (post_id); -- Supports post audit lookup and SET NULL updates.
CREATE INDEX moderation_actions_comment_idx ON moderation_actions (comment_id); -- Supports comment audit lookup and SET NULL updates.
CREATE INDEX moderation_actions_target_user_idx ON moderation_actions (target_user_id); -- Supports user audit lookup and SET NULL updates.
CREATE INDEX moderation_actions_timeline_idx ON moderation_actions (created_at DESC); -- Loads the global moderation audit newest first.
CREATE INDEX help_resources_active_region_idx ON help_resources (region, language_code) WHERE is_active; -- Finds active resources for the user's locale.
CREATE INDEX help_resources_created_idx ON help_resources (created_at DESC); -- Supports recently added resource sorting.
CREATE INDEX help_resources_updated_idx ON help_resources (updated_at DESC); -- Supports recently maintained resource sorting.

CREATE INDEX user_settings_updated_idx ON user_settings (updated_at DESC); -- Supports settings maintenance/audit ordering.
CREATE INDEX notifications_user_timeline_idx ON notifications (user_id, created_at DESC); -- Loads a user's inbox newest first.
CREATE INDEX notifications_user_unread_idx ON notifications (user_id) WHERE read_at IS NULL; -- Counts and fetches only unread notifications per user.