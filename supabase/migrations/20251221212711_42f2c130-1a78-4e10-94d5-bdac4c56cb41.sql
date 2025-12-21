-- Add shuffle_answers column to quizzes table
ALTER TABLE public.quizzes 
ADD COLUMN shuffle_answers boolean NOT NULL DEFAULT false;