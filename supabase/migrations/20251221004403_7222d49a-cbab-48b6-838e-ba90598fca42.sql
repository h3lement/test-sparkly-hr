-- Add quiz_id column to email_templates to link templates to specific quizzes
ALTER TABLE public.email_templates
ADD COLUMN quiz_id uuid REFERENCES public.quizzes(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_email_templates_quiz_id ON public.email_templates(quiz_id);

-- Add unique constraint: only one live template per quiz per template_type
CREATE UNIQUE INDEX idx_email_templates_live_quiz 
ON public.email_templates(quiz_id, template_type) 
WHERE is_live = true;