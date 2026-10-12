# MindRise API Contract

All endpoints are mounted under `/api`. Authenticated endpoints use `Authorization: Bearer <JWT>`. Requests and responses use JSON unless an avatar is uploaded as multipart form data. Errors use `{ "error": { "code": "...", "message": "..." } }`. List endpoints use opaque cursor paging (`limit`, `cursor`, `nextCursor`). Dates are ISO 8601 UTC strings unless a day-based field is explicitly a local calendar date.

| Method | Path | Who may call | FR |
| --- | --- | --- | --- |
| GET | `/health` | Anyone | Operational |
| POST | `/auth/register` | Anyone | FR-1.1, 1.3 |
| POST | `/auth/verify` | Anyone with challenge | FR-1.2 |
| POST | `/auth/resend-code` | Anyone with challenge | FR-1.2 |
| POST | `/auth/login` | Anyone | FR-1.1 |
| POST | `/auth/recover/request` | Anyone | FR-1.8 |
| POST | `/auth/recover/confirm` | Anyone with challenge | FR-1.8 |
| GET | `/me` | Authenticated user | FR-1.3, 1.7 |
| PATCH | `/me/profile` | Authenticated user | FR-1.3, 1.7 |
| POST | `/me/avatar` | Authenticated user | FR-1.3 |
| GET | `/me/settings` | Authenticated user | FR-5.2 |
| PATCH | `/me/settings` | Authenticated user | FR-5.2 |
| DELETE | `/me` | Authenticated user | FR-5.4 |
| GET | `/resources` | Anyone | FR-5.1, 5.3 |
| GET | `/crisis/active` | Authenticated user | FR-4.6, FR-6.1, 6.2 |
| POST | `/crisis/acknowledge` | Authenticated user | FR-6.2 |
| GET | `/assessments` | Anyone | FR-2.1 |
| GET | `/assessments/:assessmentId` | Anyone | FR-2.1, 2.2 |
| POST | `/assessments/:assessmentId/attempts` | Authenticated, verified user | FR-2.2, 2.5 |
| POST | `/assessments/attempts/:attemptId/submit` | Attempt owner | FR-2.2, 2.3, 2.5 |
| GET | `/assessments/history` | Authenticated user | FR-2.3, 2.4 |
| DELETE | `/assessments/attempts/:attemptId` | Attempt owner | FR-2.4 |
| GET | `/routines` | Authenticated user | FR-3.1 |
| GET | `/goals` | Authenticated user | FR-3.1 |
| POST | `/goals` | Authenticated user | FR-3.1 |
| PATCH | `/goals/:goalId` | Goal owner | FR-3.1 |
| DELETE | `/goals/:goalId` | Goal owner | FR-3.1 |
| POST | `/goals/:goalId/complete` | Goal owner | FR-3.2 |
| GET | `/progress` | Authenticated user | FR-3.2 |
| GET | `/badges` | Authenticated user | FR-3.3 |
| GET | `/community/spaces` | Authenticated user | FR-4.2 |
| GET | `/community/posts` | Authenticated user | FR-4.1, 4.2 |
| POST | `/community/posts` | Verified, unrestricted user | FR-4.1, 4.2 |
| PATCH | `/community/posts/:postId` | Post owner | FR-4.1 |
| DELETE | `/community/posts/:postId` | Post owner | FR-4.1 |
| GET | `/community/posts/:postId/comments` | Authenticated user | FR-4.3 |
| POST | `/community/posts/:postId/comments` | Verified, unrestricted user | FR-4.3 |
| POST | `/community/posts/:postId/reactions` | Authenticated user | FR-4.3 |
| DELETE | `/community/posts/:postId/reactions` | Reaction owner | FR-4.3 |
| POST | `/community/reports` | Authenticated user | FR-4.4 |
| GET | `/mod/reports` | Moderator/admin | FR-7.1, 7.5 |
| GET | `/mod/crisis-flags` | Authorized moderator/admin | FR-2.5, FR-7.4 |
| POST | `/mod/reports/:reportId/assign` | Moderator/admin | FR-7.1 |
| POST | `/mod/crisis-flags/:flagId/assign` | Moderator/admin | FR-7.4 |
| POST | `/mod/reports/:reportId/resolve` | Moderator/admin | FR-7.1 |
| POST | `/mod/crisis-flags/:flagId/resolve` | Authorized moderator/admin | FR-7.4 |
| POST | `/mod/reports/:reportId/dismiss` | Moderator/admin | FR-7.1 |
| POST | `/mod/posts/:postId/hide` | Moderator/admin | FR-7.2, 7.6 |
| POST | `/mod/posts/:postId/restore` | Moderator/admin | FR-7.2, 7.6 |
| DELETE | `/mod/posts/:postId` | Moderator/admin | FR-7.2, 7.6 |
| POST | `/mod/comments/:commentId/hide` | Moderator/admin | FR-7.2, 7.6 |
| POST | `/mod/comments/:commentId/restore` | Moderator/admin | FR-7.2, 7.6 |
| DELETE | `/mod/comments/:commentId` | Moderator/admin | FR-7.2, 7.6 |
| POST | `/mod/users/:userId/warn` | Moderator/admin | FR-7.2 |
| POST | `/mod/users/:userId/restrict` | Moderator/admin | FR-7.5, 7.7 |
| POST | `/mod/users/:userId/unrestrict` | Moderator/admin | FR-7.7 |
| POST | `/mod/users/:userId/suspend` | Moderator/admin | FR-7.2 |
| POST | `/mod/users/:userId/ban` | Admin | FR-7.2 |
| GET | `/mod/log` | Moderator/admin | FR-7.3 |
| GET | `/notifications` | Authenticated user | FR-5.x |
| PATCH | `/notifications/:notificationId/read` | Notification owner | FR-5.x |
| POST | `/notifications/read-all` | Authenticated user | FR-5.x |

The `login`, `recover`, and `offline` screens are additional screens implied by the SRS flows even where the screen list does not name them explicitly. Identity values, assessment answers, reporter IDs, OTPs, and tokens must not be included in public responses or logs.

For verification and resend requests with purpose `contact_change`, the proposed contact destination must be supplied again in each request. The API keeps it transient until verification succeeds; it must not be persisted in `verification_challenges` or logged. Resource responses expose a provider number as `contactPhone` (database `help_resources.contact_phone`), distinct from a user's verified phone number.