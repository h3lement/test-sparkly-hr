-- Add Start Quiz CTA fields to quizzes table
ALTER TABLE public.quizzes
ADD COLUMN start_cta_text jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN start_cta_secondary_text jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN start_cta_url text DEFAULT NULL,
ADD COLUMN start_cta_secondary_url text DEFAULT NULL;