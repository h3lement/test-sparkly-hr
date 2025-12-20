-- Create the update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =====================================================
-- MULTI-QUIZ ARCHITECTURE: Tables for quizzes, questions, and answers
-- =====================================================

-- Main quizzes table with unique URL slugs
CREATE TABLE public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title JSONB NOT NULL DEFAULT '{}'::jsonb,
  description JSONB NOT NULL DEFAULT '{}'::jsonb,
  badge_text JSONB NOT NULL DEFAULT '{}'::jsonb,
  headline JSONB NOT NULL DEFAULT '{}'::jsonb,
  headline_highlight JSONB NOT NULL DEFAULT '{}'::jsonb,
  discover_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_text JSONB NOT NULL DEFAULT '{}'::jsonb,
  cta_url TEXT DEFAULT 'https://sparkly.hr',
  cta_text JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Quiz questions table
CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  question_text JSONB NOT NULL DEFAULT '{}'::jsonb,
  question_type TEXT NOT NULL DEFAULT 'single_choice',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, question_order)
);

-- Quiz answers table
CREATE TABLE public.quiz_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  answer_order INTEGER NOT NULL,
  answer_text JSONB NOT NULL DEFAULT '{}'::jsonb,
  score_value INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(question_id, answer_order)
);

-- Result levels for each quiz
CREATE TABLE public.quiz_result_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  min_score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  title JSONB NOT NULL DEFAULT '{}'::jsonb,
  description JSONB NOT NULL DEFAULT '{}'::jsonb,
  insights JSONB NOT NULL DEFAULT '[]'::jsonb,
  emoji TEXT DEFAULT '🌟',
  color_class TEXT DEFAULT 'from-emerald-500 to-green-600',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add quiz_id reference to quiz_leads
ALTER TABLE public.quiz_leads 
ADD COLUMN quiz_id UUID REFERENCES public.quizzes(id);

-- Create indexes
CREATE INDEX idx_quizzes_slug ON public.quizzes(slug);
CREATE INDEX idx_quizzes_active ON public.quizzes(is_active);
CREATE INDEX idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);
CREATE INDEX idx_quiz_answers_question_id ON public.quiz_answers(question_id);
CREATE INDEX idx_quiz_result_levels_quiz_id ON public.quiz_result_levels(quiz_id);
CREATE INDEX idx_quiz_leads_quiz_id ON public.quiz_leads(quiz_id);

-- Enable RLS on all new tables
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_result_levels ENABLE ROW LEVEL SECURITY;

-- Public read access for active quizzes (anyone can take quizzes)
CREATE POLICY "Anyone can view active quizzes"
ON public.quizzes FOR SELECT
USING (is_active = true);

CREATE POLICY "Anyone can view quiz questions"
ON public.quiz_questions FOR SELECT
USING (EXISTS (SELECT 1 FROM public.quizzes WHERE id = quiz_id AND is_active = true));

CREATE POLICY "Anyone can view quiz answers"
ON public.quiz_answers FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.quiz_questions q
  JOIN public.quizzes qz ON q.quiz_id = qz.id
  WHERE q.id = question_id AND qz.is_active = true
));

CREATE POLICY "Anyone can view quiz result levels"
ON public.quiz_result_levels FOR SELECT
USING (EXISTS (SELECT 1 FROM public.quizzes WHERE id = quiz_id AND is_active = true));

-- Admin full access
CREATE POLICY "Admins can manage quizzes"
ON public.quizzes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage quiz questions"
ON public.quiz_questions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage quiz answers"
ON public.quiz_answers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage quiz result levels"
ON public.quiz_result_levels FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updating quizzes.updated_at
CREATE TRIGGER update_quizzes_updated_at
BEFORE UPDATE ON public.quizzes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();