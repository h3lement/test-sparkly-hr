-- Add openness_score column to quiz_leads table
ALTER TABLE public.quiz_leads 
ADD COLUMN openness_score integer DEFAULT NULL;