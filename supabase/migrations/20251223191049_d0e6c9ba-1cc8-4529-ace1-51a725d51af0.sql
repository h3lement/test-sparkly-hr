-- Add retry button text field to quizzes table
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS cta_retry_text jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add retry button text field to cta_templates table
ALTER TABLE public.cta_templates 
ADD COLUMN IF NOT EXISTS cta_retry_text jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.quizzes.cta_retry_text IS 'Translatable text for the "Take Quiz Again" button in results screen';
COMMENT ON COLUMN public.cta_templates.cta_retry_text IS 'Translatable text for the "Take Quiz Again" button in results screen';