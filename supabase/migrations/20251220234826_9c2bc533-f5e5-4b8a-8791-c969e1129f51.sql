-- Create table for open-mindedness result levels
CREATE TABLE public.open_mindedness_result_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  min_score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  title JSONB NOT NULL DEFAULT '{}'::jsonb,
  description JSONB NOT NULL DEFAULT '{}'::jsonb,
  emoji TEXT DEFAULT '🧠',
  color_class TEXT DEFAULT 'from-blue-500 to-indigo-600',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.open_mindedness_result_levels ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage open-mindedness result levels"
ON public.open_mindedness_result_levels
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view open-mindedness result levels"
ON public.open_mindedness_result_levels
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM quizzes
    WHERE quizzes.id = open_mindedness_result_levels.quiz_id
    AND quizzes.is_active = true
  )
);