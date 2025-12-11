-- Add language column to quiz_leads table
ALTER TABLE public.quiz_leads 
ADD COLUMN language text DEFAULT 'en';