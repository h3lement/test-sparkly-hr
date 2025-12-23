-- Fix the foreign key to use ON DELETE SET NULL
-- First drop the existing constraint and recreate with proper behavior
ALTER TABLE public.email_logs 
DROP CONSTRAINT IF EXISTS email_logs_quiz_lead_id_fkey;

ALTER TABLE public.email_logs
ADD CONSTRAINT email_logs_quiz_lead_id_fkey 
FOREIGN KEY (quiz_lead_id) 
REFERENCES public.quiz_leads(id) 
ON DELETE SET NULL;