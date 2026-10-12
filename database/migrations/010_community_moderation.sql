CREATE TABLE community_spaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    translations jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT community_space_slug_nonempty CHECK (length(btrim(slug)) > 0),
    CONSTRAINT community_space_title_nonempty CHECK (length(btrim(title)) > 0),
    CONSTRAINT community_space_translations_object CHECK (jsonb_typeof(translations) = 'object')
);

ALTER TABLE community_posts
    ADD COLUMN space_id uuid REFERENCES community_spaces(id) ON DELETE RESTRICT;

CREATE TABLE post_reactions (
    post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind text NOT NULL DEFAULT 'support',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT post_reaction_kind CHECK (kind IN ('support')),
    PRIMARY KEY (post_id, user_id, kind)
);

ALTER TABLE content_reports
    ADD COLUMN reported_user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE content_reports DROP CONSTRAINT report_exactly_one_target;
ALTER TABLE content_reports ADD CONSTRAINT report_exactly_one_target CHECK (
    (post_id IS NOT NULL)::integer + (comment_id IS NOT NULL)::integer + (reported_user_id IS NOT NULL)::integer = 1
);

CREATE UNIQUE INDEX content_reports_reporter_post_uq ON content_reports (reporter_id, post_id)
    WHERE reporter_id IS NOT NULL AND post_id IS NOT NULL;
-- Prevents duplicate reports by one reporter for a post.
CREATE UNIQUE INDEX content_reports_reporter_comment_uq ON content_reports (reporter_id, comment_id)
    WHERE reporter_id IS NOT NULL AND comment_id IS NOT NULL;
-- Prevents duplicate reports by one reporter for a comment.
CREATE UNIQUE INDEX content_reports_reporter_user_uq ON content_reports (reporter_id, reported_user_id)
    WHERE reporter_id IS NOT NULL AND reported_user_id IS NOT NULL;
-- Prevents duplicate reports by one reporter for an account.

ALTER TABLE users
    ADD COLUMN restricted_until timestamptz,
    ADD COLUMN restriction_reason text;