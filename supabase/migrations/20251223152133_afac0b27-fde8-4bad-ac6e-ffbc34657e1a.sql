-- Add openness_score column to hypothesis_leads table
ALTER TABLE public.hypothesis_leads 
ADD COLUMN IF NOT EXISTS openness_score integer DEFAULT NULL;