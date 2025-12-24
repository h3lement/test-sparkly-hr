-- Create global open-mindedness module table (single row)
CREATE TABLE public.global_open_mindedness_module (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_text jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create global open-mindedness answers table
CREATE TABLE public.global_open_mindedness_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  answer_text jsonb NOT NULL DEFAULT '{}'::jsonb,
  answer_order integer NOT NULL,
  score_value integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.global_open_mindedness_module ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_open_mindedness_answers ENABLE ROW LEVEL SECURITY;

-- RLS policies for global_open_mindedness_module
CREATE POLICY "Admins can manage global OM module" 
ON public.global_open_mindedness_module 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view global OM module for active quizzes" 
ON public.global_open_mindedness_module 
FOR SELECT 
USING (true);

-- RLS policies for global_open_mindedness_answers
CREATE POLICY "Admins can manage global OM answers" 
ON public.global_open_mindedness_answers 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view global OM answers" 
ON public.global_open_mindedness_answers 
FOR SELECT 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_global_om_updated_at
BEFORE UPDATE ON public.global_open_mindedness_module
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the initial global module with data from existing OM question
INSERT INTO public.global_open_mindedness_module (question_text)
SELECT question_text 
FROM public.quiz_questions 
WHERE question_type = 'open_mindedness' 
LIMIT 1;

-- Insert answers from one of the existing OM questions
INSERT INTO public.global_open_mindedness_answers (answer_text, answer_order, score_value)
SELECT qa.answer_text, qa.answer_order, qa.score_value
FROM public.quiz_answers qa
JOIN public.quiz_questions qq ON qa.question_id = qq.id
WHERE qq.question_type = 'open_mindedness'
AND qq.id = (SELECT id FROM public.quiz_questions WHERE question_type = 'open_mindedness' LIMIT 1)
ORDER BY qa.answer_order;