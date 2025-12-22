-- Create CTA templates table (similar structure to email_templates)
CREATE TABLE public.cta_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid REFERENCES public.quizzes(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  is_live boolean NOT NULL DEFAULT false,
  cta_title jsonb NOT NULL DEFAULT '{}'::jsonb,
  cta_description jsonb NOT NULL DEFAULT '{}'::jsonb,
  cta_text jsonb NOT NULL DEFAULT '{}'::jsonb,
  cta_url text DEFAULT 'https://sparkly.hr',
  created_by uuid,
  created_by_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cta_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as email_templates)
CREATE POLICY "Admins can manage CTA templates"
ON public.cta_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view live CTA templates for active quizzes"
ON public.cta_templates
FOR SELECT
USING (
  is_live = true AND
  EXISTS (
    SELECT 1 FROM quizzes
    WHERE quizzes.id = cta_templates.quiz_id
    AND quizzes.is_active = true
  )
);

-- Create trigger to ensure only one live version per quiz
CREATE OR REPLACE FUNCTION public.ensure_single_live_cta_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_live = true THEN
    UPDATE public.cta_templates 
    SET is_live = false 
    WHERE quiz_id = NEW.quiz_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_single_live_cta
BEFORE INSERT OR UPDATE ON public.cta_templates
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_live_cta_version();

-- Create index for faster lookups
CREATE INDEX idx_cta_templates_quiz_id ON public.cta_templates(quiz_id);
CREATE INDEX idx_cta_templates_is_live ON public.cta_templates(quiz_id, is_live) WHERE is_live = true;