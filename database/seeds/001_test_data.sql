BEGIN;

INSERT INTO users (id, role, email, password_hash, email_verified_at) VALUES
('00000000-0000-4000-8000-000000000001', 'youth', 'youth@example.test', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', now()),
('00000000-0000-4000-8000-000000000002', 'moderator', 'moderator@example.test', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', now()),
('00000000-0000-4000-8000-000000000003', 'admin', 'admin@example.test', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO verification_challenges (id, user_id, channel, destination, token_hash, expires_at) VALUES
('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'email', 'youth@example.test', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', now() + interval '1 day')
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

INSERT INTO assessment_types (id, slug, title, description) VALUES
('10000000-0000-4000-8000-000000000001', 'mood-check', 'Mood Check-in', 'A brief self-reflection, not a diagnosis.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO assessment_versions (id, assessment_type_id, version, scoring_method, result_bands, published_at) VALUES
('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 1, 'sum',
 '[{"min":0,"max":3,"label":"gentle-day"},{"min":4,"max":8,"label":"check-in"}]'::jsonb, now())
ON CONFLICT (assessment_type_id, version) DO NOTHING;

INSERT INTO assessment_questions (id, assessment_version_id, position, prompt, response_options) VALUES
('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 1, 'How have you felt today?', '[{"value":"okay","score":0},{"value":"low","score":2}]'::jsonb),
('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 2, 'How connected have you felt?', '[{"value":"connected","score":0},{"value":"alone","score":2}]'::jsonb)
ON CONFLICT (assessment_version_id, position) DO NOTHING;

INSERT INTO assessment_attempts (id, user_id, assessment_version_id, status, completed_at, total_score, result_band, result_summary) VALUES
('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'completed', now(), 2, 'gentle-day', 'A reflection only; reach out to someone you trust if you need support.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO assessment_answers (attempt_id, question_id, answer_value, score) VALUES
('10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', '"okay"'::jsonb, 0),
('10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', '"alone"'::jsonb, 2)
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

INSERT INTO community_posts (id, author_id, body) VALUES
('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'What is one small thing that helped you feel grounded today?'),
('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'A reminder: you deserve support, even when you do not have the right words.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO community_comments (id, post_id, author_id, body) VALUES
('30000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Taking a short walk can be a gentle start.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO content_reports (id, reporter_id, post_id, reason) VALUES
('30000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'Test moderation queue item')
ON CONFLICT (id) DO NOTHING;

INSERT INTO moderation_actions (id, moderator_id, report_id, action, reason) VALUES
('30000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004', 'dismiss_report', 'Seeded example moderation audit.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO help_resources (id, title, description, resource_type, language_code, region, phone, url, availability, is_crisis_resource) VALUES
('40000000-0000-4000-8000-000000000001', 'Local emergency services', 'For immediate danger, contact local emergency services or go to the nearest hospital.', 'emergency', 'en', 'ET', '911', 'https://www.gov.et/', 'Emergency', true),
('40000000-0000-4000-8000-000000000002', 'Trusted person check-in', 'Contact a trusted family member, teacher, or health professional.', 'peer-support', 'am', 'ET', '+251000000000', 'https://www.moh.gov.et/', 'Check local availability', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO notifications (id, user_id, notification_type, title, body, payload) VALUES
('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'community_reply', 'A peer replied', 'Someone responded to your community post.', '{"postId":"30000000-0000-4000-8000-000000000001"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

COMMIT;