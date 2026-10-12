BEGIN;

-- These assessment thresholds and strings are fixture placeholders only, not reviewed clinical guidance.

INSERT INTO users (id, role, password_hash) VALUES
('00000000-0000-4000-8000-000000000001', 'youth', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'),
('00000000-0000-4000-8000-000000000002', 'moderator', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'),
('00000000-0000-4000-8000-000000000003', 'admin', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
ON CONFLICT (id) DO NOTHING;

INSERT INTO verified_identities (user_id, first_name, last_name, email, email_verified_at, terms_accepted_at, disclaimer_accepted_at, consent_version) VALUES
('00000000-0000-4000-8000-000000000001', 'Test', 'Youth', 'youth@example.test', now(), now(), now(), 'TO_VERIFY'),
('00000000-0000-4000-8000-000000000002', 'Test', 'Moderator', 'moderator@example.test', now(), now(), now(), 'TO_VERIFY'),
('00000000-0000-4000-8000-000000000003', 'Test', 'Admin', 'admin@example.test', now(), now(), now(), 'TO_VERIFY')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO verification_challenges (id, user_id, channel, token_hash, expires_at) VALUES
('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'email', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', now() + interval '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (user_id, alias, avatar_path, bio) VALUES
('00000000-0000-4000-8000-000000000001', 'SelamSunrise', 'uploads/avatars/test-youth.webp', 'Taking one day at a time.'),
('00000000-0000-4000-8000-000000000002', 'CommunityGuide', NULL, 'Here to keep this space supportive.'),
('00000000-0000-4000-8000-000000000003', 'MindRiseAdmin', NULL, 'Platform administrator.')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_settings (user_id) VALUES
('00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000002'),
('00000000-0000-4000-8000-000000000003')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_stats (user_id, points, current_streak, best_streak, last_active_on) VALUES
('00000000-0000-4000-8000-000000000001', 10, 1, 1, current_date),
('00000000-0000-4000-8000-000000000002', 0, 0, 0, NULL),
('00000000-0000-4000-8000-000000000003', 0, 0, 0, NULL)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO community_spaces (id, slug, title, description, translations) VALUES
('60000000-0000-4000-8000-000000000001', 'general-wellbeing', 'General wellbeing', 'Everyday peer support.', '{"am":{"title":"TO_VERIFY","description":"TO_VERIFY"}}'::jsonb),
('60000000-0000-4000-8000-000000000002', 'job-search', 'Job search', 'Peer support for seeking work.', '{"am":{"title":"TO_VERIFY","description":"TO_VERIFY"}}'::jsonb),
('60000000-0000-4000-8000-000000000003', 'academic-pressure', 'Academic pressure', 'Peer support around study and exams.', '{"am":{"title":"TO_VERIFY","description":"TO_VERIFY"}}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO assessment_types (id, slug, title, description) VALUES
('10000000-0000-4000-8000-000000000001', 'mood-check', 'TO_VERIFY', 'TO_VERIFY')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO assessment_versions (id, assessment_type_id, version, scoring_method, result_bands, risk_threshold, published_at) VALUES
('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 1, 'sum',
 '[{"min":0,"max":3,"label":"TO_VERIFY"},{"min":4,"max":8,"label":"TO_VERIFY"}]'::jsonb, 0, now())
ON CONFLICT (assessment_type_id, version) DO NOTHING;

INSERT INTO assessment_questions (id, assessment_version_id, position, prompt, response_options, risk_min_score) VALUES
('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 1, 'TO_VERIFY', '[{"value":"TO_VERIFY","score":0},{"value":"TO_VERIFY","score":2}]'::jsonb, 0),
('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 2, 'TO_VERIFY', '[{"value":"TO_VERIFY","score":0},{"value":"TO_VERIFY","score":2}]'::jsonb, NULL)
ON CONFLICT (assessment_version_id, position) DO NOTHING;

INSERT INTO assessment_attempts (id, user_id, assessment_version_id, status, completed_at, total_score, result_band, result_summary) VALUES
('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'completed', now(), 2, 'TO_VERIFY', 'TO_VERIFY')
ON CONFLICT (id) DO NOTHING;

INSERT INTO assessment_answers (attempt_id, question_id, answer_value, score) VALUES
('10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', '"TO_VERIFY"'::jsonb, 0),
('10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', '"TO_VERIFY"'::jsonb, 2)
ON CONFLICT (attempt_id, question_id) DO NOTHING;

INSERT INTO routines (id, slug, title, description) VALUES
('20000000-0000-4000-8000-000000000001', 'mindful-minute', 'Mindful minute', 'Pause for one minute and notice your breathing.'),
('20000000-0000-4000-8000-000000000002', 'daily-water', 'Drink water', 'Have a glass of water and check in with yourself.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO badges (id, slug, title, description) VALUES
('20000000-0000-4000-8000-000000000003', 'first-step', 'First step', 'Completed a first wellbeing routine.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO user_goals (id, user_id, routine_id, title, target_per_week) VALUES
('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Pause each day', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO routine_completions (user_id, routine_id, goal_id, completed_on) VALUES
('00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', current_date)
ON CONFLICT (user_id, routine_id, completed_on) DO NOTHING;

INSERT INTO user_streaks (user_id, routine_id, current_days, best_days, last_completed_on) VALUES
('00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 1, current_date)
ON CONFLICT (user_id, routine_id) DO NOTHING;

INSERT INTO user_badges (user_id, badge_id) VALUES
('00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003')
ON CONFLICT (user_id, badge_id) DO NOTHING;

INSERT INTO community_posts (id, author_id, space_id, body) VALUES
('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'What is one small thing that helped you feel grounded today?'),
('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', 'A reminder: you deserve support, even when you do not have the right words.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO post_reactions (post_id, user_id, kind) VALUES
('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'support')
ON CONFLICT (post_id, user_id, kind) DO NOTHING;

INSERT INTO community_comments (id, post_id, author_id, body) VALUES
('30000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Taking a short walk can be a gentle start.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO content_reports (id, reporter_id, post_id, reason) VALUES
('30000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'Test moderation queue item')
ON CONFLICT (id) DO NOTHING;

INSERT INTO moderation_actions (id, moderator_id, report_id, action, reason) VALUES
('30000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004', 'dismiss_report', 'Seeded example moderation audit.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO crisis_flags (id, user_id, source, attempt_id, status) VALUES
('30000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'assessment', '10000000-0000-4000-8000-000000000005', 'open')
ON CONFLICT (id) DO NOTHING;

INSERT INTO help_resources (id, title, description, resource_type, language_code, region, contact_phone, url, availability, is_crisis_resource) VALUES
('40000000-0000-4000-8000-000000000001', 'TO_VERIFY', 'TO_VERIFY', 'emergency', 'en', 'ET', 'TO_VERIFY', NULL, 'TO_VERIFY', true),
('40000000-0000-4000-8000-000000000002', 'TO_VERIFY', 'TO_VERIFY', 'peer-support', 'am', 'ET', 'TO_VERIFY', NULL, 'TO_VERIFY', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO notifications (id, user_id, notification_type, title, body, payload) VALUES
('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'community_reply', 'A peer replied', 'Someone responded to your community post.', '{"postId":"30000000-0000-4000-8000-000000000001"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

COMMIT;