-- Add separate interview question fields for women and men
ALTER TABLE public.hypothesis_questions
ADD COLUMN interview_question_woman jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN interview_question_man jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Migrate existing data: copy interview_question to both new columns
UPDATE public.hypothesis_questions
SET 
  interview_question_woman = interview_question,
  interview_question_man = interview_question
WHERE interview_question != '{}'::jsonb;