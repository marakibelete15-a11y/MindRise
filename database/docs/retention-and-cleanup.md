# Retention and Cleanup

## Avatars

The database stores only a validated relative `profiles.avatar_path`, for example `uploads/avatars/<random-id>.webp`; never store an absolute path or client-supplied path. The API must resolve it beneath `backend/uploads/avatars`, reject traversal, and serve only approved image types. On replacement, remove the previous file after the DB update commits. On account deletion, first mark the account `deletion_pending` and hide owned content, then delete avatar files and account data after a documented 30-day recovery window. A scheduled local cleanup job should remove unreferenced files older than 24 hours (to cover interrupted uploads) and purge expired verification challenges daily.

If an avatar file is absent, return the profile normally with `avatarUrl: null` (or the app's bundled default avatar URL); do not return a filesystem path or fail the profile request. Log the missing relative path for repair, without exposing it to clients.

## Removed Content and Personal Data

For ordinary moderation removal, set content status to `removed`, set `deleted_at`, and retain the body for 90 days for appeals and safety review; then permanently delete it and cascade dependent comments/reports. Keep moderation actions for 12 months, with actor/target references nullable, then purge them. Closed reports may be purged after 12 months; open/reviewing reports are retained until resolved. Account deletion anonymizes authors (`SET NULL`) immediately for visible community context, while personal account records are purged after the 30-day recovery period. Do not include assessment answers in moderation exports. Restrict DB access and local backups to authorized operators; expire backups after 30 days. Retention jobs must be logged and tested before production use.

Run periodic cleanup in a local scheduled process (for example, systemd timer or cron), not from a public API request. Use batched deletes and transactions; back up before the first production purge. These periods are product defaults and should be reviewed for local legal and safeguarding obligations.

## Retention Schedule

| Data | Retention |
| --- | --- |
| Verification challenges | Delete after expiry/consumption; scheduled cleanup. |
| Assessment answers and attempts | Retain while the account is active; user-requested/account deletion removes attempts and cascades answers. No moderator export includes answer values. |
| Notifications | Delete with the account; expire read notifications according to product policy. |
| Removed posts/comments | 90 days for appeals and safety review, then purge. |
| Closed content reports | 12 months after closure; open/reviewing reports remain until resolved. |
| Moderation actions | 12 months, then purge. |
| Crisis flags | Keep while open/reviewing; retain resolved flags for 12 months, then purge unless a documented safeguarding/legal hold applies. |
| Identity access log | 12 months, then purge. |
| Backups | 30 days maximum; access restricted to authorized operators. |
| Reactions | Delete with the associated post or user. |

## Account Deletion Procedure

1. On request, mark `users.status = 'deletion_pending'` and record the request time in `deleted_at`. Deny new sessions and hide the profile immediately.
2. Immediately set `community_posts.author_id` and `community_comments.author_id` to NULL (the existing `ON DELETE SET NULL` rules do this at physical deletion; an API/scheduled anonymization step must do it at request time). Preserve visible community text only according to the removed-content policy.
3. Allow a 30-day recovery window. A verified recovery restores the account and its profile visibility.
4. After 30 days, purge the account in a privileged scheduled cleanup transaction. `verified_identities`, profiles, attempts/answers, goals, settings, stats, notifications, and reactions cascade with the user. Post/comment authors and audit actors/targets become NULL; crisis user ownership cascades. The report target `reported_user_id` cascades, while report reporter/assignee references become NULL.
5. Delete avatar files and unreferenced upload files in a separate batched filesystem cleanup. If a file is missing, return the profile with `avatarUrl: null`.

The exact timing, authorization, immediate anonymization, recovery flow, and filesystem cleanup are enforced in the API/scheduled job; PostgreSQL alone does not implement a 30-day delay. Cleanup is never triggered by a public API route, supports `--dry-run`, and uses bounded batches.