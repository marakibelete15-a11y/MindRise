CREATE TABLE verified_identities (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,
    email_verified_at timestamptz,
    phone_verified_at timestamptz,
    terms_accepted_at timestamptz,
    disclaimer_accepted_at timestamptz,
    consent_version text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT verified_identity_first_name_nonempty CHECK (length(btrim(first_name)) > 0),
    CONSTRAINT verified_identity_last_name_nonempty CHECK (length(btrim(last_name)) > 0),
    CONSTRAINT verified_identity_contact_present CHECK (email IS NOT NULL OR phone IS NOT NULL),
    CONSTRAINT verified_identity_email_nonempty CHECK (email IS NULL OR length(btrim(email)) > 0),
    CONSTRAINT verified_identity_phone_nonempty CHECK (phone IS NULL OR length(btrim(phone)) > 0),
    CONSTRAINT verified_identity_contacts_distinct CHECK (email IS NULL OR phone IS NULL OR email <> phone)
);

COMMENT ON TABLE verified_identities IS 'RESTRICTED: never expose through any API used by other users or moderators.';
COMMENT ON COLUMN verified_identities.user_id IS 'RESTRICTED: never expose through any API used by other users or moderators.';
COMMENT ON COLUMN verified_identities.first_name IS 'RESTRICTED: never expose through any API used by other users or moderators.';
COMMENT ON COLUMN verified_identities.last_name IS 'RESTRICTED: never expose through any API used by other users or moderators.';
COMMENT ON COLUMN verified_identities.email IS 'RESTRICTED: never expose through any API used by other users or moderators.';
COMMENT ON COLUMN verified_identities.phone IS 'RESTRICTED: never expose through any API used by other users or moderators.';
COMMENT ON COLUMN verified_identities.email_verified_at IS 'RESTRICTED: never expose through any API used by other users or moderators.';
COMMENT ON COLUMN verified_identities.phone_verified_at IS 'RESTRICTED: never expose through any API used by other users or moderators.';
COMMENT ON COLUMN verified_identities.terms_accepted_at IS 'RESTRICTED: never expose through any API used by other users or moderators.';
COMMENT ON COLUMN verified_identities.disclaimer_accepted_at IS 'RESTRICTED: never expose through any API used by other users or moderators.';
COMMENT ON COLUMN verified_identities.consent_version IS 'RESTRICTED: never expose through any API used by other users or moderators.';
COMMENT ON COLUMN verified_identities.created_at IS 'RESTRICTED: never expose through any API used by other users or moderators.';
COMMENT ON COLUMN verified_identities.updated_at IS 'RESTRICTED: never expose through any API used by other users or moderators.';

INSERT INTO verified_identities (user_id, first_name, last_name, email, phone, email_verified_at, phone_verified_at)
SELECT id, 'Unknown', 'Unknown', email, phone, email_verified_at, phone_verified_at
FROM users
WHERE email IS NOT NULL OR phone IS NOT NULL;

CREATE UNIQUE INDEX verified_identities_email_lower_uq ON verified_identities (lower(email)) WHERE email IS NOT NULL;
-- Enforces one account per case-insensitive email address (FR-1.5).
CREATE UNIQUE INDEX verified_identities_phone_uq ON verified_identities (phone) WHERE phone IS NOT NULL;
-- Enforces one account per phone number (FR-1.5).

DROP INDEX users_email_lower_uq;
DROP INDEX users_phone_uq;
ALTER TABLE users DROP CONSTRAINT users_email_nonempty;
ALTER TABLE users DROP CONSTRAINT users_phone_nonempty;
ALTER TABLE users DROP CONSTRAINT users_contact_unique_input;
ALTER TABLE users DROP COLUMN email;
ALTER TABLE users DROP COLUMN phone;
ALTER TABLE users DROP COLUMN email_verified_at;
ALTER TABLE users DROP COLUMN phone_verified_at;

-- Existing-contact delivery resolves through verified_identities; contact-change destinations stay transient.
ALTER TABLE verification_challenges DROP COLUMN destination;

-- Resource contact numbers are not user identity; use an explicit name for privacy audits.
ALTER TABLE help_resources RENAME COLUMN phone TO contact_phone;

CREATE UNIQUE INDEX profiles_alias_lower_uq ON profiles (lower(btrim(alias)));
-- Enforces case-insensitive unique public handles (FR-1.3).
ALTER TABLE profiles ADD CONSTRAINT profiles_avatar_path_safe CHECK (
    avatar_path IS NULL OR (
        avatar_path !~ '^[[:alpha:]][[:alnum:]+.-]*:'
        AND avatar_path NOT LIKE '/%'
        AND avatar_path NOT LIKE E'\\%'
        AND avatar_path !~ '(^|/)\.\.(/|$)'
    )
);

CREATE TYPE verification_purpose AS ENUM ('signup', 'recovery', 'contact_change');
ALTER TABLE verification_challenges
    ADD COLUMN purpose verification_purpose NOT NULL DEFAULT 'signup',
    ADD COLUMN attempts smallint NOT NULL DEFAULT 0,
    ADD CONSTRAINT verification_attempts_nonnegative CHECK (attempts >= 0);

CREATE TABLE identity_access_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
    target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    reason text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT identity_access_reason_nonempty CHECK (length(btrim(reason)) > 0)
);

COMMENT ON TABLE identity_access_log IS 'Audit trail for authorized access to verified identity records.';
COMMENT ON COLUMN identity_access_log.actor_id IS 'Restricted audit metadata for authorized identity access.';
COMMENT ON COLUMN identity_access_log.target_user_id IS 'Restricted audit metadata for the identity record accessed.';