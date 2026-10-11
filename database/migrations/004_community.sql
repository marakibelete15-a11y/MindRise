CREATE TYPE community_post_status AS ENUM ('visible', 'hidden', 'removed');
CREATE TYPE moderation_action_type AS ENUM ('hide_post', 'restore_post', 'remove_post', 'hide_comment', 'restore_comment', 'remove_comment', 'dismiss_report', 'suspend_user');
CREATE TYPE report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

CREATE TABLE community_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid REFERENCES users(id) ON DELETE SET NULL,
    body text NOT NULL,
    status community_post_status NOT NULL DEFAULT 'visible',
    is_anonymous boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT post_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 5000)
);

CREATE TABLE community_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    author_id uuid REFERENCES users(id) ON DELETE SET NULL,
    parent_comment_id uuid REFERENCES community_comments(id) ON DELETE SET NULL,
    body text NOT NULL,
    status community_post_status NOT NULL DEFAULT 'visible',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT comment_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 3000)
);

CREATE TABLE content_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id uuid REFERENCES users(id) ON DELETE SET NULL,
    post_id uuid REFERENCES community_posts(id) ON DELETE CASCADE,
    comment_id uuid REFERENCES community_comments(id) ON DELETE CASCADE,
    reason text NOT NULL,
    details text,
    status report_status NOT NULL DEFAULT 'open',
    assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT report_exactly_one_target CHECK ((post_id IS NOT NULL)::integer + (comment_id IS NOT NULL)::integer = 1),
    CONSTRAINT report_reason_length CHECK (char_length(btrim(reason)) BETWEEN 2 AND 100),
    CONSTRAINT report_details_length CHECK (details IS NULL OR char_length(details) <= 2000)
);

CREATE TABLE moderation_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    moderator_id uuid REFERENCES users(id) ON DELETE SET NULL,
    report_id uuid REFERENCES content_reports(id) ON DELETE SET NULL,
    post_id uuid REFERENCES community_posts(id) ON DELETE SET NULL,
    comment_id uuid REFERENCES community_comments(id) ON DELETE SET NULL,
    target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action moderation_action_type NOT NULL,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT moderation_action_target CHECK (
        (post_id IS NOT NULL)::integer + (comment_id IS NOT NULL)::integer + (target_user_id IS NOT NULL)::integer <= 1
    )
);