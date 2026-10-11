CREATE TYPE assessment_attempt_status AS ENUM ('in_progress', 'completed', 'abandoned');

CREATE TABLE assessment_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assessment_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_type_id uuid NOT NULL REFERENCES assessment_types(id) ON DELETE RESTRICT,
    version integer NOT NULL,
    scoring_method text NOT NULL DEFAULT 'sum',
    result_bands jsonb NOT NULL DEFAULT '[]'::jsonb,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT assessment_version_positive CHECK (version > 0),
    CONSTRAINT assessment_scoring_method CHECK (scoring_method IN ('sum', 'average')),
    CONSTRAINT assessment_result_bands_array CHECK (jsonb_typeof(result_bands) = 'array'),
    UNIQUE (assessment_type_id, version)
);

CREATE TABLE assessment_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_version_id uuid NOT NULL REFERENCES assessment_versions(id) ON DELETE CASCADE,
    position integer NOT NULL,
    prompt text NOT NULL,
    response_options jsonb NOT NULL,
    is_required boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT question_position_positive CHECK (position > 0),
    CONSTRAINT question_options_array CHECK (jsonb_typeof(response_options) = 'array'),
    UNIQUE (assessment_version_id, position)
);

CREATE TABLE assessment_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assessment_version_id uuid NOT NULL REFERENCES assessment_versions(id) ON DELETE RESTRICT,
    status assessment_attempt_status NOT NULL DEFAULT 'in_progress',
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    total_score numeric(8,2),
    result_band text,
    result_summary text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT attempt_completion_consistent CHECK (
        (status = 'completed' AND completed_at IS NOT NULL AND total_score IS NOT NULL)
        OR (status <> 'completed' AND completed_at IS NULL)
    ),
    CONSTRAINT attempt_score_nonnegative CHECK (total_score IS NULL OR total_score >= 0)
);

CREATE TABLE assessment_answers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id uuid NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    question_id uuid NOT NULL REFERENCES assessment_questions(id) ON DELETE RESTRICT,
    answer_value jsonb NOT NULL,
    score numeric(8,2) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT answer_score_nonnegative CHECK (score >= 0),
    UNIQUE (attempt_id, question_id)
);