# SRS Database Coverage

The SRS v1.3 full text was not present in the repository during this schema pass. This mapping uses the requirement identifiers and descriptions supplied in the implementation brief; confirm wording and any omitted subclauses against the controlled SRS before release. “Enforced in API” means the database lacks the workflow, authorization, or presentation context needed to enforce the requirement alone.

Schema note: `verification_challenges.destination` was deliberately dropped in 008 to avoid a second persistent copy of account contact data. Existing challenge hashes and expiry are preserved, but contact-change requests must resupply their pending destination during verify/resend, with the backend keeping it transient until successful verification. `help_resources.phone` was renamed to `contact_phone`; PostgreSQL preserves its values during the rename, and the field represents a resource provider's public number, not a user's real identity.

| Requirement | Database support | Gap |
| --- | --- | --- |
| FR-1.1 | `verified_identities.email`, `phone`; `verification_challenges` | OTP delivery and verification workflow enforced in API. |
| FR-1.2 | `verification_challenges.token_hash`, `expires_at`, `purpose`, `attempts` | Hashing, expiry enforcement, attempt lockout, and delivery enforced in API. |
| FR-1.3 | `profiles.alias`, `profiles_alias_lower_uq`, alias length check | Profile creation/change authorization enforced in API. |
| FR-1.4 | `profiles.avatar_path` with relative-path checks | Upload validation and orphan cleanup enforced in API/job. |
| FR-1.5 | Unique lower(email) and phone indexes on `verified_identities` | Contact normalization/verification enforced in API. |
| FR-1.6 | `verified_identities.terms_accepted_at`, `disclaimer_accepted_at`, `consent_version` | Displaying and capturing affirmative consent enforced in API. |
| FR-1.7 | `profiles`, `user_settings` | Public profile serialization and privacy controls enforced in API. |
| FR-1.8 | Verification purpose `recovery`; private verified contacts | OTP recovery and credential reset enforced in API. |
| FR-2.1 | `assessment_types`, `assessment_versions`, `assessment_questions` | Assessment publication and access enforced in API. |
| FR-2.2 | Versioned assessment rows and JSON response options | Client workflow and scoring validation enforced in API. |
| FR-2.3 | `assessment_attempts`, `assessment_answers`, result bands | Result presentation/history authorization enforced in API. |
| FR-2.4 | Attempt rows; user FK cascades allow user-initiated deletion | Deletion endpoint and authorization enforced in API. |
| FR-2.5 | `risk_threshold`, `risk_min_score`, `crisis_flags` | Risk evaluation and resource surfacing enforced in API; never diagnose. |
| FR-3.1 | `routines`, `user_goals` | Starter catalog lifecycle and goal CRUD enforced in API. |
| FR-3.2 | `routine_completions`, `user_stats`, `user_streaks` | Daily streak/points calculation enforced in API. |
| FR-3.3 | `badges`, `user_badges` | Badge award rules enforced in API. |
| FR-4.1 | `community_spaces`, `community_posts`, `community_comments` | Publishing permissions and visibility enforced in API. |
| FR-4.2 | `community_spaces`, `community_posts.space_id` | Space membership/active-space validation enforced in API. |
| FR-4.3 | `community_comments`, `post_reactions` | Rate limits and author permissions enforced in API. |
| FR-4.4 | `content_reports` post/comment/account targets and uniqueness | Report intake/rate limits enforced in API. |
| FR-4.5 | Community records reference internal user IDs only | Anonymous serializers must avoid identity joins; enforced in API. |
| FR-4.6 | `crisis_flags` separate from `content_reports` | Crisis detection, acknowledgement, and resource display enforced in API. |
| FR-5.1 | `translations` on assessment types/questions, routines, badges, spaces; `help_resources.language_code` | Translation completeness and fallback enforced in API. |
| FR-5.2 | `user_settings.language_code` | Language selection and locale loading enforced in API/client. |
| FR-5.3 | `help_resources` plus client offline fallback | Offline cache behavior enforced in client/service worker. |
| FR-5.4 | Private identity separation; encrypted-data design documented in `security-notes.md` | AES-256-GCM, key management, disk encryption operations, and access enforcement outside SQL. |
| FR-5.5 | `user_settings.timezone` | Locale-aware rendering enforced in client/API. |
| FR-5.6 | Translation columns and locale-coded resource rows | Human translation review and quality control required. |
| FR-6.1 | Static resource catalog and planned crisis endpoint | Always-visible crisis navigation enforced in client. |
| FR-6.2 | `verified_identities` consent timestamps; crisis flag acknowledgment timestamp | Consent UX and acknowledgement behavior enforced in API/client. |
| FR-6.3 | `crisis_flags.assigned_to`, source references and separate queue | Role authorization and safe review enforced in API. |
| FR-6.4 | No diagnosis column; schema comment says resource surfacing only | Non-diagnostic language and model behavior enforced in API/content review. |
| FR-7.1 | `content_reports`, `moderation_actions` | Moderator authorization enforced in API. |
| FR-7.2 | `moderation_action_type` includes warning/restriction/unrestriction/ban actions | Workflow validation enforced in API. |
| FR-7.3 | `moderation_actions` audit rows | Complete action logging enforced in API. |
| FR-7.4 | `crisis_flags` moderator queue | Assignment and resolution workflow enforced in API. |
| FR-7.5 | `content_reports.reported_user_id`, per-target uniqueness and count index | Time-window threshold calculation and automatic action enforced in API/job. |
| FR-7.6 | `moderation_actions` records content/user actions | Restore/hide/remove authorization and audit completeness enforced in API. |
| FR-7.7 | `users.restricted_until`, `restriction_reason`, `account_status` | Posting gates, expiry reversal, suspension and ban semantics enforced in API/job. |
| SRS 2.1 | `profiles` separated from `verified_identities` | Serializer and join permissions enforced in API. |
| SRS 5.4 | Identity access log, nullable author/moderator references, retention docs | 30-day deletion orchestration, encryption, logging, and export control enforced outside SQL. |
| SRS 6.1 | `verified_identities` owns contact and names | Verification workflow enforced in API. |
| SRS 6.2 | Consent/disclaimer timestamps and version; crisis flag acknowledgement | Consent text/version lifecycle and UX enforced in API. |
| SRS 6.3 | Crisis records retain user and moderator references | Least-privilege access and auditing enforced in API. |
| SRS 6.4 | Crisis resources in `help_resources`; `crisis_flags` | Human-verified content and non-diagnostic response enforced in API. |