# Database Delivery Checklist

Audit date: 2026-10-12. PASS is used only where the exact schema/docs were inspected or the stated check was run. The system PostgreSQL role lacked `CREATEDB`; runtime verification used an isolated disposable PostgreSQL 18 cluster with `unix_socket_directories` set to a temporary `/tmp/mindrise-pg.*` directory. The cluster was removed after testing.

| ID | Status | Evidence |
| --- | --- | --- |
| DB-1.1 | PASS | `srs-coverage.md` contains one row for every FR identifier from FR-1.1 through FR-7.7 and for SRS 2.1, 5.4, and 6.1–6.4; each row maps to schema support or names its gap. The controlled SRS v1.3 full text is not in the repository, so source-wording reconciliation remains a human review note, not an unmapped identifier. |
| DB-1.2 | PASS | Fresh-cluster information-schema query listed `email`, `first_name`, `last_name`, `phone` only on `verified_identities`; `users contact columns absent = true`. Captured `\\d users` columns: `id`, `role`, `status`, `password_hash`, `created_at`, `updated_at`, `deleted_at`, `restricted_until`, `restriction_reason`. Upgrade test moved `legacy@example.test` and its verification timestamp into that table. Resource number is named `contact_phone`. |
| DB-1.3 | PASS | `008_identity_privacy.sql`: case-insensitive unique alias, existing length check, relative/traversal-safe avatar check; alias remains in `profiles`. |
| DB-1.4 | PASS | `004_community.sql`, `010_community_moderation.sql`: people referenced by UUID; only public profile fields are in `profiles`. |
| DB-1.5 | PASS | `001_identity.sql`, `008_identity_privacy.sql`: token hash/expiry, purpose, attempts and unique contact indexes. |
| DB-1.6 | PASS | `008_identity_privacy.sql`: acceptance timestamps and consent version. |
| DB-1.7 | PASS | `002_assessments.sql`, `009_crisis.sql`: versions/options/history, score and completion constraint, risk threshold/item; no diagnosis column. |
| DB-1.8 | PASS | `003_routines.sql`, `012_progress.sql`: routines/goals/completions, custom-goal daily uniqueness, per-user stats and badges. |
| DB-1.9 | PASS | `004_community.sql`, `010_community_moderation.sql`: spaces, posts/comments/reactions, account reports and per-target uniqueness. Reporter exposure remains API-controlled. |
| DB-1.10 | PASS | `009_crisis.sql`, `014_indexes_phase2.sql`: separate flag table, source/status/acknowledgment and oldest-first queue. |
| DB-1.11 | PASS | `004_community.sql`, `010_community_moderation.sql`, `011_moderation_enums.sql`: action log, temporary restriction end and moderation enum values. |
| DB-1.12 | PASS | `005_resources.sql`, `006_notifications_settings.sql`, `010_community_moderation.sql`, `013_translations.sql`: language setting and supported content localization fields. |
| DB-1.13 | PASS | `008_identity_privacy.sql`: `identity_access_log`. |
| DB-1.14 | PASS | `006_notifications_settings.sql`: per-user settings and notifications. |
| DB-2.1 | PASS | Executed FK/index catalog query from `indexes-and-deletes.md`; returned zero unindexed foreign-key columns. |
| DB-2.2 | PASS | Exact index definitions read in `007_indexes.sql` and `014_indexes_phase2.sql`: feed, comments, histories, goals/completions, unread notifications, report/crisis queues, moderation timeline. |
| DB-2.3 | PASS | `014_indexes_phase2.sql`: `(reported_user_id, created_at DESC)` partial index. |
| DB-2.4 | PASS | `008_identity_privacy.sql`: unique partial indexes on lower(email) and phone. |
| DB-2.5 | PASS | Exact SQL inspected: every index in 007 has an inline reason; each index in 014 has a reason comment immediately after it. |
| DB-2.6 | PASS | `pg_indexes` grouped by schema/table/index definition; returned zero duplicate index definitions. Intentional prefix overlap: full `community_posts_space_fk_idx` covers FK checks; partial feed index covers visible feed ordering. |
| DB-3.1 | PASS | `git diff -- database/migrations/001_identity.sql ... 007_indexes.sql` produced no output at audit start. |
| DB-3.2 | PASS | Disposable PostgreSQL 18 cluster (`unix_socket_directories` under `/tmp`): first `npm run db:migrate` applied 001–014; second printed no `Applied` lines. Each file and tracking row committed atomically; 011 contains only enum additions. |
| DB-3.3 | PASS | Two `npm run db:seed` runs completed without errors; final counts: 3 users, 3 identities, 3 spaces, 1 crisis flag, 1 reaction, 3 stats. `.test` emails and `TO_VERIFY` content; same database was queried after both runs. |
| DB-3.4 | PASS | Named checks inspected across migrations; `indexes-and-deletes.md` lists each FK deletion action and reason. Negative checks below confirm key integrity constraints. |
| DB-3.5 | PASS | Fresh-cluster DO block printed six notices: `1/6 duplicate case-insensitive handle rejected`, `2/6 duplicate email rejected`, `3/6 duplicate custom-goal completion rejected`, `4/6 same reporter duplicate target rejected`, `5/6 report with two targets rejected`, and `6/6 completed attempt without score rejected`. |
| DB-3.6 | PASS | `NODE_ENV=production node scripts/seed.js` exited 1 and printed `Refusing to run test-data seeds when NODE_ENV=production.` |
| DB-3.7 | PASS | All application tables declared by migrations 001–014 are represented in `er-diagram.md`; standalone `help_resources` is explicitly listed. |
| DB-4.1 | PASS | `retention-and-cleanup.md` lists verification, assessment, notifications, removed content, reports, moderation, crisis, identity logs, backups and reactions. |
| DB-4.2 | PASS | `retention-and-cleanup.md` documents deletion_pending, 30-day recovery, immediate anonymization step and FK effects. |
| DB-4.3 | PASS | `retention-and-cleanup.md` documents relative paths, orphan cleanup and missing-avatar fallback; SQL path check in 008. |
| DB-4.4 | PASS | `security-notes.md` excludes answers from moderator views/exports except audited crisis review. API implementation remains required. |
| DB-4.5 | PASS | `security-notes.md` specifies disk encryption, application AES-256-GCM and authorized identity readers. |
| DB-4.6 | PASS | Executed `node backend/scripts/cleanup.js --dry-run` and `node backend/scripts/cleanup.js --execute`. Dry run logs candidate counts without mutating state; execute performs batched deletions in transactions, purges expired verification challenges, 30-day deletion_pending accounts, 90-day removed posts/comments, 12-month reports/actions/logs, and 24-hour unreferenced avatar files. |

## Executed SQL Evidence

Fresh-cluster schema query for new tables returned: `community_spaces`, `crisis_flags`, `identity_access_log`, `post_reactions`, `user_stats`, `verified_identities` (all six present).

Identity query:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
	AND column_name IN ('first_name', 'last_name', 'email', 'phone')
ORDER BY table_name, column_name;
```

Output contained exactly four rows, all with `table_name = verified_identities`: `email`, `first_name`, `last_name`, `phone`. The separate `users` contact-column count returned `0` (`passed = true`).

The FK/index coverage query printed zero rows. The duplicate-index-definition query printed zero rows. The validation run configured PostgreSQL using `-c unix_socket_directories=$tmp_dir` where `$tmp_dir` was created under `/tmp`, then removed the cluster with a shell cleanup trap. The six negative inserts each printed a numbered `... rejected: PASS` notice. Migration run two contained no applied migration output; both seed runs completed and the expected row counts above remained stable.

Upgrade-path evidence: applied 001–007, inserted a legacy user/contact, an active verification challenge with destination, and a resource `phone`; then applied 008–014. The user appeared as `Unknown Unknown` with the original email and verification timestamp in `verified_identities`. The active challenge retained its token hash, purpose `signup`, attempts `0`, and future expiry, while `destination` was absent. The resource value was returned unchanged as `contact_phone`.