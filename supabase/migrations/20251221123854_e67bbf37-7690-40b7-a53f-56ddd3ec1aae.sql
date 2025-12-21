-- Add CTA customization fields to quizzes table
ALTER TABLE public.quizzes
ADD COLUMN cta_title jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN cta_description jsonb NOT NULL DEFAULT '{}'::jsonb;