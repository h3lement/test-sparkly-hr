-- Add tone_intensity column to quizzes table (0-9 scale, default 4 = "Balanced")
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS tone_intensity integer DEFAULT 4;