CREATE TYPE crisis_flag_source AS ENUM ('assessment', 'post', 'comment');
CREATE TYPE crisis_flag_status AS ENUM ('open', 'reviewing', 'resolved');

CREATE TABLE crisis_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source crisis_flag_source NOT NULL,
    attempt_id uuid REFERENCES assessment_attempts(id) ON DELETE SET NULL,
    post_id uuid REFERENCES community_posts(id) ON DELETE SET NULL,
    comment_id uuid REFERENCES community_comments(id) ON DELETE SET NULL,
    status crisis_flag_status NOT NULL DEFAULT 'open',
    user_acknowledged_at timestamptz,
    assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT crisis_flag_single_source CHECK (
        (attempt_id IS NOT NULL)::integer + (post_id IS NOT NULL)::integer + (comment_id IS NOT NULL)::integer <= 1
    ),
    CONSTRAINT crisis_flag_resolution_consistent CHECK (status <> 'resolved' OR resolved_at IS NOT NULL)
);

COMMENT ON TABLE crisis_flags IS 'Safety queue: the system surfaces resources and never diagnoses (FR-6.4).';

ALTER TABLE assessment_versions
    ADD COLUMN risk_threshold numeric(8,2),
    ADD CONSTRAINT assessment_risk_threshold_nonnegative CHECK (risk_threshold IS NULL OR risk_threshold >= 0);

ALTER TABLE assessment_questions
    ADD COLUMN risk_min_score numeric(8,2),
    ADD CONSTRAINT question_risk_min_score_nonnegative CHECK (risk_min_score IS NULL OR risk_min_score >= 0);