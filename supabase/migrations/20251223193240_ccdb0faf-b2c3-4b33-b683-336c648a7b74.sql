-- Add cta_template_id column to quizzes table to allow many quizzes to reference one CTA
ALTER TABLE public.quizzes 
ADD COLUMN cta_template_id uuid REFERENCES public.cta_templates(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_quizzes_cta_template_id ON public.quizzes(cta_template_id);

-- Migrate existing relationships: find CTAs that have quiz_id set and update the quiz to reference that CTA
UPDATE public.quizzes q
SET cta_template_id = c.id
FROM public.cta_templates c
WHERE c.quiz_id = q.id AND c.is_live = true;