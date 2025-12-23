-- Remove version_number column from cta_templates
ALTER TABLE public.cta_templates DROP COLUMN version_number;

-- Add unique constraint to ensure one CTA per quiz
ALTER TABLE public.cta_templates ADD CONSTRAINT cta_templates_quiz_id_unique UNIQUE (quiz_id);