-- Add show_confetti toggle to quizzes table (default ON)
ALTER TABLE public.quizzes 
ADD COLUMN show_confetti boolean NOT NULL DEFAULT true;