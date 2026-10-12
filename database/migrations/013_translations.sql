ALTER TABLE assessment_types
    ADD COLUMN translations jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT assessment_types_translations_object CHECK (jsonb_typeof(translations) = 'object');
COMMENT ON COLUMN assessment_types.translations IS 'Locale map shape: {"am": {"title": "...", "description": "...", "prompt": "..."}}.';

ALTER TABLE assessment_questions
    ADD COLUMN translations jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT assessment_questions_translations_object CHECK (jsonb_typeof(translations) = 'object');
COMMENT ON COLUMN assessment_questions.translations IS 'Locale map shape: {"am": {"title": "...", "description": "...", "prompt": "..."}}.';

ALTER TABLE routines
    ADD COLUMN translations jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT routines_translations_object CHECK (jsonb_typeof(translations) = 'object');
COMMENT ON COLUMN routines.translations IS 'Locale map shape: {"am": {"title": "...", "description": "...", "prompt": "..."}}.';

ALTER TABLE badges
    ADD COLUMN translations jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT badges_translations_object CHECK (jsonb_typeof(translations) = 'object');
COMMENT ON COLUMN badges.translations IS 'Locale map shape: {"am": {"title": "...", "description": "...", "prompt": "..."}}.';