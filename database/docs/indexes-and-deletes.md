# Indexes and Delete Behavior

## Indexes

`007_indexes.sql` and `014_indexes_phase2.sql` provide a one-line reason for each index. Primary keys and declared `UNIQUE` constraints also create indexes. The dedicated indexes cover every FK not already leading a primary/unique index, common chronological feeds/history, unread notifications, open moderation work, crisis queues, and reported-account counting. `community_posts_space_fk_idx` is full (not partial) to cover the space FK for hidden and deleted posts too.

## FK Delete Behavior

| Relationship | Behavior | Reason |
| --- | --- | --- |
| verification challenges -> users | CASCADE | One-time credentials have no value after account deletion. |
| profiles -> users | CASCADE | Profile is owned by and inseparable from its account. |
| assessment versions -> assessment types | RESTRICT | Preserve published assessment definitions and historical interpretation. |
| assessment questions -> assessment versions | CASCADE | Questions are components of a version and may be removed only with that version. |
| assessment attempts -> users | CASCADE | Personal assessment history is deleted on account deletion. |
| assessment attempts -> assessment versions | RESTRICT | Historical results must retain their scoring definition. |
| assessment answers -> attempts | CASCADE | Answers have no independent meaning after their attempt is removed. |
| assessment answers -> questions | RESTRICT | Protect question references used by stored scoring history. |
| user goals -> users | CASCADE | Goals are user-owned data. |
| user goals -> routines | SET NULL | Preserve a user's custom goal if a catalog routine is retired. |
| completions -> users | CASCADE | Completion history is personal data. |
| completions -> routines/goals | SET NULL | Preserve completion evidence if its catalog or goal is removed. |
| streaks -> users/routines | CASCADE | Streak aggregates are derived and owned by both records. |
| user badges -> users | CASCADE | Account deletion removes earned-badge ownership. |
| user badges -> badges | RESTRICT | Do not erase a badge definition while awarded. |
| posts -> authors | SET NULL | Keep community context while severing account identity. |
| comments -> posts | CASCADE | Comments cannot outlive their containing post. |
| comments -> authors/parent comments | SET NULL | Preserve discussion and child replies without identity or missing parent reference. |
| reports -> reporter/assignee | SET NULL | Keep the moderation record while allowing account removal. |
| reports -> reported post/comment | CASCADE | A report about removed content has no actionable target. |
| moderation actions -> moderator/targets/report | SET NULL | Preserve audit evidence when related records are purged. |
| user settings -> users | CASCADE | Settings belong exclusively to the account. |
| notifications -> users | CASCADE | Notifications are private account data. |
| verified identities -> users | CASCADE | Private identity is erased with its account. |
| identity access log actor/target -> users | SET NULL | Preserve the audit event without retaining a deleted account reference. |
| crisis flags -> flagged user | CASCADE | Remove the user's safety record on account purge. |
| crisis flags -> assessment attempt/post/comment | SET NULL | Retain the safety queue record while allowing source data to be purged. |
| crisis flags -> assigned moderator | SET NULL | Keep the flag when a moderator account is removed. |
| community posts -> community space | RESTRICT | Preserve the topic reference while posts exist. |
| post reactions -> post/user | CASCADE | Reactions are dependent on their post and account. |
| reports -> reported user | CASCADE | A report about an account is removed when that target account is purged. |
| community posts -> content reports | Existing CASCADE | Reports about purged posts have no actionable content target. |
| completions -> goal | Existing SET NULL | Preserve activity history if the custom goal is removed. |
| user stats -> users | CASCADE | Progress aggregates are account-owned. |

The DB does not enforce that `assigned_to`, `actor_id`, `moderator_id`, or `assigned_to` has a moderator/admin role; API authorization must enforce that rule. Crisis source fields are mutually exclusive when populated, but may all become NULL after content purge. Report targets are exclusive and report uniqueness is enforced in SQL.

## Foreign-key index coverage

Every foreign key is indexed or is the leading column of a primary/unique index. The complete catalog verification query is:

```sql
WITH fk_columns AS (
	SELECT conrelid::regclass AS table_name, a.attname AS column_name
	FROM pg_constraint c
	CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
	JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
	WHERE c.contype = 'f'
), indexed_columns AS (
	SELECT i.indrelid::regclass AS table_name, a.attname AS column_name
	FROM pg_index i
	CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum, ord)
	JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
	WHERE k.ord = 1
)
SELECT f.table_name, f.column_name
FROM fk_columns f
LEFT JOIN indexed_columns i USING (table_name, column_name)
WHERE i.column_name IS NULL;
```

Expected result: zero rows. The query must be run against the migrated database before marking the index-coverage audit PASS.