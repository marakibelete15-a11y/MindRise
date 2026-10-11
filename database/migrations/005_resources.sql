CREATE TABLE help_resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    resource_type text NOT NULL,
    language_code text NOT NULL DEFAULT 'en',
    region text NOT NULL DEFAULT 'ET',
    phone text,
    url text,
    availability text,
    is_crisis_resource boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT resource_type_nonempty CHECK (length(btrim(resource_type)) > 0),
    CONSTRAINT resource_language_format CHECK (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
    CONSTRAINT resource_contact_present CHECK (phone IS NOT NULL OR url IS NOT NULL),
    CONSTRAINT resource_url_http CHECK (url IS NULL OR url ~ '^https?://')
);