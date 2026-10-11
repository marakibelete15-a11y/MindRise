# Retention and Cleanup

## Avatars

The database stores only a validated relative `profiles.avatar_path`, for example `uploads/avatars/<random-id>.webp`; never store an absolute path or client-supplied path. The API must resolve it beneath `backend/uploads/avatars`, reject traversal, and serve only approved image types. On replacement, remove the previous file after the DB update commits. On account deletion, first mark the account `deletion_pending` and hide owned content, then delete avatar files and account data after a documented 30-day recovery window. A scheduled local cleanup job should remove unreferenced files older than 24 hours (to cover interrupted uploads) and purge expired verification challenges daily.

If an avatar file is absent, return the profile normally with `avatarUrl: null` (or the app's bundled default avatar URL); do not return a filesystem path or fail the profile request. Log the missing relative path for repair, without exposing it to clients.

## Removed Content and Personal Data

For ordinary moderation removal, set content status to `removed`, set `deleted_at`, and retain the body for 90 days for appeals and safety review; then permanently delete it and cascade dependent comments/reports. Keep moderation actions for 12 months, with actor/target references nullable, then purge them. Closed reports may be purged after 12 months; open/reviewing reports are retained until resolved. Account deletion anonymizes authors (`SET NULL`) immediately for visible community context, while personal account records are purged after the 30-day recovery period. Do not include assessment answers in moderation exports. Restrict DB access and local backups to authorized operators; expire backups after 30 days. Retention jobs must be logged and tested before production use.

Run periodic cleanup in a local scheduled process (for example, systemd timer or cron), not from a public API request. Use batched deletes and transactions; back up before the first production purge. These periods are product defaults and should be reviewed for local legal and safeguarding obligations.