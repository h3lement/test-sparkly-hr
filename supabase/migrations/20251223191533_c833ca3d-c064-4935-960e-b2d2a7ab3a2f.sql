-- Add cta_retry_url column to quizzes table
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS cta_retry_url text DEFAULT NULL;

COMMENT ON COLUMN public.quizzes.cta_retry_url IS 'Custom URL for the retry/take again button';

-- Add cta_retry_url column to cta_templates table
ALTER TABLE public.cta_templates 
ADD COLUMN IF NOT EXISTS cta_retry_url text DEFAULT NULL;

COMMENT ON COLUMN public.cta_templates.cta_retry_url IS 'Custom URL for the retry/take again button';