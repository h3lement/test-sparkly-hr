-- Add translation metadata column to quizzes table
-- Stores: translation timestamps per language, field hashes for change detection, accumulated costs
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS translation_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Example structure:
-- {
--   "source_hashes": { "title": "abc123", "description": "def456", ... },
--   "translations": {
--     "de": { "translated_at": "2024-01-15T10:00:00Z", "field_hashes": {...}, "is_complete": true },
--     "fr": { "translated_at": "2024-01-15T10:00:00Z", "field_hashes": {...}, "is_complete": true }
--   },
--   "total_cost_usd": 0.0025
-- }

COMMENT ON COLUMN public.quizzes.translation_meta IS 'Stores translation tracking: source field hashes, per-language translation status/timestamps, and accumulated AI translation costs';