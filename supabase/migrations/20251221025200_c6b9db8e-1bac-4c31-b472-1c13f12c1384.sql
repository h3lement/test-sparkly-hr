-- Add columns to store the correct answers for each hypothesis
ALTER TABLE public.hypothesis_questions 
ADD COLUMN correct_answer_woman boolean NOT NULL DEFAULT false,
ADD COLUMN correct_answer_man boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.hypothesis_questions.correct_answer_woman IS 'The correct True/False answer for Women 50+';
COMMENT ON COLUMN public.hypothesis_questions.correct_answer_man IS 'The correct True/False answer for Men 50+';