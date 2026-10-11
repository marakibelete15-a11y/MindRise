CREATE TYPE user_role AS ENUM ('youth', 'moderator', 'admin');
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'deletion_pending');
CREATE TYPE verification_channel AS ENUM ('email', 'phone');

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role user_role NOT NULL DEFAULT 'youth',
    status account_status NOT NULL DEFAULT 'active',
    email text,
    phone text,
    password_hash text NOT NULL,
    email_verified_at timestamptz,
    phone_verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT users_email_nonempty CHECK (email IS NULL OR length(btrim(email)) > 0),
    CONSTRAINT users_phone_nonempty CHECK (phone IS NULL OR length(btrim(phone)) > 0),
    CONSTRAINT users_contact_unique_input CHECK (email IS NULL OR phone IS NULL OR email <> phone)
);
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX users_phone_uq ON users (phone) WHERE phone IS NOT NULL;

CREATE TABLE verification_challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel verification_channel NOT NULL,
    destination text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT verification_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE TABLE profiles (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    alias text NOT NULL,
    avatar_path text,
    bio text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT profiles_alias_length CHECK (char_length(btrim(alias)) BETWEEN 2 AND 40),
    CONSTRAINT profiles_avatar_relative CHECK (avatar_path IS NULL OR (avatar_path NOT LIKE '/%' AND avatar_path NOT LIKE '%..%')),
    CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR char_length(bio) <= 500)
);