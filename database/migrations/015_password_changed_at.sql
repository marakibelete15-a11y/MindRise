ALTER TABLE users ADD COLUMN password_changed_at timestamptz;
-- Invalidation timestamp for JWT sessions issued before a password change or reset (SRS FR-1.8).
