-- Add tone_of_voice column to quizzes table
ALTER TABLE public.quizzes 
ADD COLUMN tone_of_voice TEXT DEFAULT '';

-- Add tone_source to track whether it's AI-generated, extracted, or manual
ALTER TABLE public.quizzes 
ADD COLUMN tone_source TEXT DEFAULT 'manual' CHECK (tone_source IN ('ai', 'extracted', 'manual'));

-- Add use_tone_for_ai flag to control if AI should use this tone
ALTER TABLE public.quizzes 
ADD COLUMN use_tone_for_ai BOOLEAN DEFAULT true;