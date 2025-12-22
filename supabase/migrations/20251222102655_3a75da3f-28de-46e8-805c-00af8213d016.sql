-- Create table for UI translations (static website text)
CREATE TABLE public.ui_translations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  translation_key TEXT NOT NULL,
  translations JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, translation_key)
);

-- Create index for fast lookups
CREATE INDEX idx_ui_translations_quiz_id ON public.ui_translations(quiz_id);
CREATE INDEX idx_ui_translations_key ON public.ui_translations(translation_key);

-- Enable RLS
ALTER TABLE public.ui_translations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view UI translations for active quizzes"
ON public.ui_translations
FOR SELECT
USING (
  quiz_id IS NULL OR 
  EXISTS (
    SELECT 1 FROM quizzes WHERE quizzes.id = ui_translations.quiz_id AND quizzes.is_active = true
  )
);

CREATE POLICY "Admins can manage UI translations"
ON public.ui_translations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_ui_translations_updated_at
BEFORE UPDATE ON public.ui_translations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();