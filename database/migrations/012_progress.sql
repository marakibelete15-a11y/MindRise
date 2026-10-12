CREATE TABLE user_stats (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    points integer NOT NULL DEFAULT 0,
    current_streak integer NOT NULL DEFAULT 0,
    best_streak integer NOT NULL DEFAULT 0,
    last_active_on date,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_stats_points_nonnegative CHECK (points >= 0),
    CONSTRAINT user_stats_streaks_consistent CHECK (current_streak >= 0 AND best_streak >= current_streak)
);

CREATE UNIQUE INDEX routine_completions_user_goal_day_uq
    ON routine_completions (user_id, goal_id, completed_on)
    WHERE goal_id IS NOT NULL;
-- Allows only one completion per user goal per day, including custom goals.

COMMENT ON TABLE user_streaks IS 'Per-routine streaks; user_stats stores the overall consecutive-activity streak required by the SRS.';