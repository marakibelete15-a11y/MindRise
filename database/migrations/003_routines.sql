CREATE TABLE routines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    description text,
    cadence text NOT NULL DEFAULT 'daily',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT routines_cadence CHECK (cadence IN ('daily', 'weekly'))
);

CREATE TABLE user_goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    routine_id uuid REFERENCES routines(id) ON DELETE SET NULL,
    title text NOT NULL,
    target_per_week smallint NOT NULL DEFAULT 7,
    starts_on date NOT NULL DEFAULT current_date,
    ends_on date,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT goal_target_range CHECK (target_per_week BETWEEN 1 AND 7),
    CONSTRAINT goal_dates_valid CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE routine_completions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    routine_id uuid REFERENCES routines(id) ON DELETE SET NULL,
    goal_id uuid REFERENCES user_goals(id) ON DELETE SET NULL,
    completed_on date NOT NULL DEFAULT current_date,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT completion_note_length CHECK (note IS NULL OR char_length(note) <= 500),
    UNIQUE (user_id, routine_id, completed_on)
);

CREATE TABLE user_streaks (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    routine_id uuid NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    current_days integer NOT NULL DEFAULT 0,
    best_days integer NOT NULL DEFAULT 0,
    last_completed_on date,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, routine_id),
    CONSTRAINT streak_values_nonnegative CHECK (current_days >= 0 AND best_days >= current_days)
);

CREATE TABLE badges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    description text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_badges (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE RESTRICT,
    awarded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, badge_id)
);