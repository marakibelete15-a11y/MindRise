# Indexes and Delete Behavior

## Indexes

`007_indexes.sql` has a one-line reason above each index statement. Primary keys and declared `UNIQUE` constraints also create their own indexes. The dedicated indexes cover every FK not already leading a primary/unique index, common chronological feeds/history, unread notifications, and open moderation work.

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

The DB does not enforce that `assigned_to` or `moderator_id` has a moderator/admin role; API authorization must enforce that rule and migrations/seeds must preserve role data. A report target's exclusive post/comment check is enforced in SQL.