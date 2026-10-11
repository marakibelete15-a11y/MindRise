CREATE TABLE user_settings (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    language_code text NOT NULL DEFAULT 'en',
    timezone text NOT NULL DEFAULT 'Africa/Addis_Ababa',
    push_enabled boolean NOT NULL DEFAULT true,
    email_enabled boolean NOT NULL DEFAULT false,
    profile_visibility text NOT NULL DEFAULT 'anonymous',
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT settings_language_format CHECK (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
    CONSTRAINT settings_visibility CHECK (profile_visibility IN ('anonymous', 'private'))
);

CREATE TABLE notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT notification_payload_object CHECK (jsonb_typeof(payload) = 'object')
);