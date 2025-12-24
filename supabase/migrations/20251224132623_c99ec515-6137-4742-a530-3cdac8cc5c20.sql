-- Create hypothesis_result_levels table (same structure as open_mindedness_result_levels)
CREATE TABLE public.hypothesis_result_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  min_score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  title JSONB NOT NULL DEFAULT '{}'::jsonb,
  description JSONB NOT NULL DEFAULT '{}'::jsonb,
  emoji TEXT DEFAULT '🏆',
  color_class TEXT DEFAULT 'from-green-500 to-emerald-600',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hypothesis_result_levels ENABLE ROW LEVEL SECURITY;

-- Admins can manage hypothesis result levels
CREATE POLICY "Admins can manage hypothesis result levels"
ON public.hypothesis_result_levels
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view hypothesis result levels for active quizzes
CREATE POLICY "Anyone can view hypothesis result levels for active quizzes"
ON public.hypothesis_result_levels
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM quizzes
  WHERE quizzes.id = hypothesis_result_levels.quiz_id
  AND quizzes.is_active = true
));

-- Create index for performance
CREATE INDEX idx_hypothesis_result_levels_quiz_id ON public.hypothesis_result_levels(quiz_id);